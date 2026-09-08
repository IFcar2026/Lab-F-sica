// =======================================================
// CONFIGURAÇÃO: cole aqui a URL do seu Apps Script publicado
// (Implantar -> Nova implantação -> App da Web -> copiar URL)
// =======================================================
const URL_SCRIPT = "https://script.google.com/macros/s/AKfycbxj1fi240YGOO1_eyU7jp_Z4QDYdHgkakA9r2ecDA1IvyDeULH96y7vlBP3gBWrPQQO/exec";
 
let experimentos = [];
let avisos = [];
let relatos = [];
let categorias = [];
let usuarioLogado = false;
 
// --- MAPEAMENTO DE ELEMENTOS ---
const welcomeScreen = document.getElementById('welcomeScreen');
const authScreen = document.getElementById('authScreen');
const mainApp = document.getElementById('mainApp');
const adminPanel = document.getElementById('adminPanel');
const userStatus = document.getElementById('userStatus');
const grid = document.getElementById('experimentsGrid');
const noticeList = document.getElementById('noticeList');
const searchBar = document.getElementById('searchBar');
 
// --- COMUNICAÇÃO COM A PLANILHA ---
// Faz a requisição e tenta de novo automaticamente se o Google devolver
// uma resposta instável (página HTML de erro em vez de JSON).
async function requisitarComRetry(fazerRequisicao, tentativas = 3) {
    for (let i = 0; i < tentativas; i++) {
        try {
            const resp = await fazerRequisicao();
            const texto = await resp.text();
            const json = JSON.parse(texto); // se vier HTML, cai no catch abaixo
            if (json.erro) throw new Error(json.erro);
            return json;
        } catch (err) {
            const ultimaTentativa = i === tentativas - 1;
            if (ultimaTentativa) throw err;
            await new Promise(r => setTimeout(r, 800 * (i + 1))); // espera um pouco antes de tentar de novo
        }
    }
}

async function buscarDaPlanilha(tipo) {
    return requisitarComRetry(() => fetch(`${URL_SCRIPT}?tipo=${tipo}`));
}

// Content-Type text/plain evita que o navegador dispare um "preflight" (OPTIONS),
// que o Apps Script não responde corretamente.
async function enviarParaPlanilha(tipo, acao, dados) {
    return requisitarComRetry(() => fetch(URL_SCRIPT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ tipo, acao, dados })
    }));
}
 
async function carregarDados() {
    try {
        grid.innerHTML = '<div class="no-results">Carregando experimentos...</div>';
        noticeList.innerHTML = '<div style="font-size:14px;">Carregando avisos...</div>';
 
        const [expData, avisosData, relatosData, categoriasData] = await Promise.all([
            buscarDaPlanilha('Experimentos'),
            buscarDaPlanilha('Avisos'),
            buscarDaPlanilha('Relatos'),
            buscarDaPlanilha('Categorias')
        ]);
 
        experimentos = expData;
        avisos = avisosData;
        relatos = relatosData;
        categorias = categoriasData;
 
        popularSelectCategoriaAddForm();
        exibirExperimentos(experimentos);
        exibirAvisos();
        if (usuarioLogado) exibirRelatosPendentes();
    } catch (err) {
        grid.innerHTML = `<div class="no-results">Erro ao carregar dados: ${err.message}</div>`;
        console.error(err);
    }
}
 
const CHAVE_TEMA = 'labfisica_tema';

function aplicarTemaSalvo() {
    const temaSalvo = localStorage.getItem(CHAVE_TEMA);
    if (temaSalvo === 'escuro') {
        document.body.classList.add('dark-mode');
        document.getElementById('botaoTema').textContent = '☀️';
    }
}

function alternarTema() {
    const escuro = document.body.classList.toggle('dark-mode');
    document.getElementById('botaoTema').textContent = escuro ? '☀️' : '🌙';
    localStorage.setItem(CHAVE_TEMA, escuro ? 'escuro' : 'claro');
}

aplicarTemaSalvo();
configurarSelectCategoria('expArea', 'expNovaCategoriaBloco');

// --- CONTROLE DE NAVEGAÇÃO ---
function entrarComoAluno() {
    usuarioLogado = false;
    welcomeScreen.style.display = 'none';
    mainApp.style.display = 'block';
    adminPanel.style.display = 'none';
    userStatus.innerHTML = "Modo: Leitura (Estudante)";
    carregarDados();
}
 
function mostrarTelaAuth() {
    welcomeScreen.style.display = 'none';
    authScreen.style.display = 'block';
}
 
function voltarParaInicio() {
    authScreen.style.display = 'none';
    mainApp.style.display = 'none';
    welcomeScreen.style.display = 'flex';
    document.getElementById('formLogin').reset();
    document.getElementById('formCadastro').reset();
}
 
function alternarTab(tipo) {
    const tabLogin = document.getElementById('tabLogin');
    const tabCadastro = document.getElementById('tabCadastro');
    const formLogin = document.getElementById('formLogin');
    const formCadastro = document.getElementById('formCadastro');
 
    if (tipo === 'login') {
        tabLogin.classList.add('active');
        tabCadastro.classList.remove('active');
        formLogin.style.display = 'block';
        formCadastro.style.display = 'none';
    } else {
        tabCadastro.classList.add('active');
        tabLogin.classList.remove('active');
        formCadastro.style.display = 'block';
        formLogin.style.display = 'none';
    }
}
 
// --- FLUXOS DE AUTENTICAÇÃO ---
async function executarCadastro(event) {
    event.preventDefault();
    const nome = document.getElementById('cadNome').value.trim();
    const senha = document.getElementById('cadPassword').value;
    const senhaConf = document.getElementById('cadPasswordConfirm').value;
    const chave = document.getElementById('cadChave').value;
 
    if (senha !== senhaConf) { alert("As senhas não coincidem!"); return; }
    if (senha.length < 4) { alert("Use uma senha com pelo menos 4 caracteres."); return; }
 
    const numeroAleatorio = Math.floor(1000000 + Math.random() * 9000000);
    const novoID = "LF" + numeroAleatorio;
 
    try {
        await enviarParaPlanilha('Professores', 'cadastrar', { id: novoID, nome, senha, chave });
        alert(`Cadastrado com sucesso!\n\nSEU ID DE ACESSO: ${novoID}\n\nGuarde esse ID e sua senha, eles serão necessários pra entrar no painel.`);
        document.getElementById('loginId').value = novoID;
        document.getElementById('formCadastro').reset();
        alternarTab('login');
    } catch (err) {
        alert("Erro ao cadastrar: " + err.message);
    }
}
 
async function executarLogin(event) {
    event.preventDefault();
    const id = document.getElementById('loginId').value.trim().toUpperCase();
    const senha = document.getElementById('loginPassword').value;
 
    try {
        const resultado = await enviarParaPlanilha('Professores', 'login', { id, senha });
        if (resultado.autorizado) {
            usuarioLogado = true;
            authScreen.style.display = 'none';
            welcomeScreen.style.display = 'none';
            mainApp.style.display = 'block';
            adminPanel.style.display = 'block';
            userStatus.innerHTML = `Modo Administrativo (${resultado.nome})`;
            carregarDados();
        } else {
            alert("ID ou senha incorretos.");
        }
    } catch (err) {
        alert("Erro ao entrar: " + err.message);
    }
}
 
function popularSelectCategoriaAddForm() {
    const select = document.getElementById('expArea');
    if (!select) return;
    select.innerHTML = `<option value="">Selecione a Área...</option>` + opcoesDeCategoria('');
}

// --- CATEGORIAS DINÂMICAS (cor customizada por categoria) ---
function corCategoria(nomeArea) {
    const cat = categorias.find(c => (c.nome || '').toLowerCase() === (nomeArea || '').toLowerCase());
    return cat ? cat.cor : '#7f8c8d'; // cinza como cor padrão pra categoria não encontrada
}

// Monta as <option> de um select de categoria, incluindo a opção de criar uma nova
function opcoesDeCategoria(valorAtual) {
    const opcoes = categorias.map(c =>
        `<option value="${c.nome}" ${c.nome === valorAtual ? 'selected' : ''}>${c.nome}</option>`
    ).join('');
    return opcoes + `<option value="__nova__">➕ Criar nova categoria...</option>`;
}

// Liga o comportamento de "mostrar campos de nova categoria" quando o select muda
function configurarSelectCategoria(idSelect, idBlocoNovaCategoria) {
    const select = document.getElementById(idSelect);
    const bloco = document.getElementById(idBlocoNovaCategoria);
    if (!select || !bloco) return;
    select.addEventListener('change', () => {
        bloco.style.display = select.value === '__nova__' ? 'block' : 'none';
    });
}

// Se o select estiver em "criar nova categoria", cria ela na planilha e devolve o nome final a usar
async function resolverCategoriaEscolhida(idSelect, idNomeNova, idCorNova) {
    const select = document.getElementById(idSelect);
    if (select.value !== '__nova__') return select.value;

    const nome = document.getElementById(idNomeNova).value.trim();
    const cor = document.getElementById(idCorNova).value;
    if (!nome) { throw new Error("Digite um nome pra nova categoria."); }

    await enviarParaPlanilha('Categorias', 'adicionar', { nome, cor });
    categorias.push({ nome, cor }); // já disponibiliza localmente, sem esperar recarregar
    return nome;
}

// --- RENDERS ---
function exibirExperimentos(lista) {
    grid.innerHTML = '';
    if (lista.length === 0) {
        grid.innerHTML = '<div class="no-results">Nenhum experimento encontrado.</div>';
        return;
    }
 
    lista.forEach(exp => {
        const card = document.createElement('div');
 
        const cor = corCategoria(exp.area);
        const desativado = exp.status === 'Desativado';
        card.className = `card card-clicavel${desativado ? ' card-desativado' : ''}`;
        card.style.borderTopColor = cor;
        card.onclick = () => abrirModalExperimento(exp.linha);
 
        let acoesAdmin = usuarioLogado ? `
            <div class="card-header-actions">
                <button class="btn-icon btn-icon-excluir" onclick="event.stopPropagation(); removerExperimento(${exp.linha})" title="Remover Experimento">🗑️</button>
            </div>
        ` : '';
 
        let seloStatus = '';
        if (exp.status === 'Em Reparo') seloStatus = `<span class="status-badge status-reparo">🛠️ Em Reparo</span>`;
        else if (exp.status === 'Com Defeito') seloStatus = `<span class="status-badge status-defeito">⚠️ Com Defeito</span>`;
        else if (exp.status === 'Desativado') seloStatus = `<span class="status-badge status-desativado">🚫 Desativado</span>`;
        else seloStatus = `<span class="status-badge status-ativo">✅ Ativo</span>`;
 
        card.innerHTML = `
            <div>
                ${acoesAdmin}
                <div class="card-top-row">
                    <span class="badge" style="background-color:${cor}22; color:${cor}; border:1px solid ${cor}55;">${exp.area || 'Não Definida'}</span>
                    ${seloStatus}
                </div>
                <h3 style="margin: 5px 0 15px 0; color: var(--primary-color); font-size:16px;">${exp.nome}</h3>
                <p class="info-item"><span class="info-label">Localização:</span> ${exp.localizacao || 'Não cadastrada'}</p>
                <p class="info-item"><span class="info-label">Componentes:</span> ${exp.componentes || 'Não catalogados'}</p>
            </div>
        `;
        grid.appendChild(card);
    });
}
 
function exibirAvisos() {
    noticeList.innerHTML = '';
    if (avisos.length === 0) {
        noticeList.innerHTML = '<div style="color:#856404; font-size:14px;">Nenhum aviso no mural.</div>';
        return;
    }
 
    avisos.forEach(av => {
        const item = document.createElement('div');
        item.className = 'notice-item';
 
        let botaoDeletarAviso = usuarioLogado ? `<button class="btn-delete" style="margin:0;" onclick="removerAviso(${av.linha})">Deletar</button>` : '';
 
        item.innerHTML = `
            <div><strong>[${av.data}] ${av.autor}:</strong> ${av.texto}</div>
            ${botaoDeletarAviso}
        `;
        noticeList.appendChild(item);
    });
}
 
// --- OPERAÇÕES ADMINISTRATIVAS (EXPERIMENTOS) ---
async function adicionarExperimentoNoGrid(event) {
    event.preventDefault();
    const nome = document.getElementById('expNome').value;
    const localizacao = document.getElementById('expLocal').value;
    const componentes = document.getElementById('expComp').value;
 
    try {
        const area = await resolverCategoriaEscolhida('expArea', 'expNovaCategoriaNome', 'expNovaCategoriaCor');
        await enviarParaPlanilha('Experimentos', 'adicionar', { nome, area, localizacao, componentes });
        document.getElementById('formNovoExperimento').reset();
        document.getElementById('expNovaCategoriaBloco').style.display = 'none';
        await carregarDados();
        popularSelectCategoriaAddForm();
    } catch (err) {
        alert("Erro ao salvar experimento: " + err.message);
    }
}
 
async function removerExperimento(linha) {
    if (!confirm("Tem certeza que deseja remover este experimento do inventário?")) return;
    try {
        await enviarParaPlanilha('Experimentos', 'remover', { linha });
        await carregarDados();
    } catch (err) {
        alert("Erro ao remover experimento: " + err.message);
    }
}
 
// --- OPERAÇÕES ADMINISTRATIVAS (AVISOS) ---
async function adicionarAvisoNoMural(event) {
    event.preventDefault();
    const autor = document.getElementById('avisoAutor').value;
    const texto = document.getElementById('avisoTexto').value;
 
    const hoje = new Date();
    const dataFormatada = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;
 
    try {
        await enviarParaPlanilha('Avisos', 'adicionar', { autor, texto, data: dataFormatada });
        document.getElementById('formNovoAviso').reset();
        await carregarDados();
    } catch (err) {
        alert("Erro ao publicar aviso: " + err.message);
    }
}
 
async function removerAviso(linha) {
    if (!confirm("Deseja apagar esse aviso do mural?")) return;
    try {
        await enviarParaPlanilha('Avisos', 'remover', { linha });
        await carregarDados();
    } catch (err) {
        alert("Erro ao remover aviso: " + err.message);
    }
}
 
// --- MODAL DE DETALHES DO EXPERIMENTO ---
function abrirModalExperimento(linha) {
    const exp = experimentos.find(e => e.linha === linha);
    if (!exp) return;

    const modalOverlay = document.getElementById('modalOverlay');
    const modalConteudo = document.getElementById('modalConteudo');

    const statusAtual = exp.status || 'Ativo';

    if (usuarioLogado) {
        const opcoesArea = opcoesDeCategoria(exp.area);

        modalConteudo.innerHTML = `
            <button class="modal-fechar" onclick="fecharModal()">✕</button>
            <h3>Editar experimento</h3>

            <div class="form-group">
                <label for="modalEditNome">Nome do experimento</label>
                <input type="text" id="modalEditNome" value="${exp.nome.replace(/"/g, '&quot;')}">
            </div>
            <div class="form-group">
                <label for="modalEditArea">Área</label>
                <select id="modalEditArea">${opcoesArea}</select>
            </div>
            <div class="form-group" id="modalNovaCategoriaBloco" style="display:none;">
                <label for="modalNovaCategoriaNome">Nome da nova categoria</label>
                <input type="text" id="modalNovaCategoriaNome" placeholder="Ex: Robótica">
                <label for="modalNovaCategoriaCor" style="margin-top:6px;">Cor da categoria</label>
                <input type="color" id="modalNovaCategoriaCor" value="#3498db" style="height:38px; padding:2px;">
            </div>
            <div class="form-group">
                <label for="modalEditLocal">Localização</label>
                <input type="text" id="modalEditLocal" value="${(exp.localizacao || '').replace(/"/g, '&quot;')}">
            </div>
            <div class="form-group">
                <label for="modalEditComp">Componentes</label>
                <input type="text" id="modalEditComp" value="${(exp.componentes || '').replace(/"/g, '&quot;')}">
            </div>
            <div class="form-group">
                <label for="modalEditStatus">Status</label>
                <select id="modalEditStatus">
                    <option value="Ativo" ${statusAtual === 'Ativo' ? 'selected' : ''}>Ativo</option>
                    <option value="Em Reparo" ${statusAtual === 'Em Reparo' ? 'selected' : ''}>Em Reparo</option>
                    <option value="Com Defeito" ${statusAtual === 'Com Defeito' ? 'selected' : ''}>Com Defeito</option>
                    <option value="Desativado" ${statusAtual === 'Desativado' ? 'selected' : ''}>Desativado (sem remover do inventário)</option>
                </select>
            </div>
            <button class="btn-admin-action" onclick="salvarEdicaoExperimento(${linha})">Salvar alterações</button>

            <div class="modal-secao">
                <h4>Relatos deste experimento</h4>
                <div id="modalRelatosDoItem"></div>
            </div>
        `;

        configurarSelectCategoria('modalEditArea', 'modalNovaCategoriaBloco');

        const relatosDoItem = relatos.filter(r => String(r.experimento_linha) === String(linha));
        const container = document.getElementById('modalRelatosDoItem');
        if (relatosDoItem.length === 0) {
            container.innerHTML = `<p style="font-size:13px; color:#7f8c8d;">Nenhum relato pendente.</p>`;
        } else {
            container.innerHTML = relatosDoItem.map(r => `
                <div class="modal-relato-item">
                    <div>${r.descricao}</div>
                    <div style="color:#7f8c8d; font-size:11px;">${r.data}</div>
                    <div class="modal-relato-acoes">
                        <button class="btn-admin-action" onclick="confirmarRelato(${r.linha}, ${linha})">Confirmar defeito</button>
                        <button class="btn-icon" onclick="descartarRelato(${r.linha})">Descartar</button>
                    </div>
                </div>
            `).join('');
        }
    } else {
        modalConteudo.innerHTML = `
            <button class="modal-fechar" onclick="fecharModal()">✕</button>
            <h3>${exp.nome}</h3>
            <p class="info-item"><span class="info-label">Área:</span> ${exp.area || 'Não definida'}</p>
            <p class="info-item"><span class="info-label">Localização:</span> ${exp.localizacao || 'Não cadastrada'}</p>
            <p class="info-item"><span class="info-label">Componentes:</span> ${exp.componentes || 'Não catalogados'}</p>
            <p class="info-item"><span class="info-label">Status atual:</span> ${statusAtual}</p>

            <div class="modal-secao">
                <div class="form-group">
                    <label for="modalRelatoTexto">Reportar problema com este experimento</label>
                    <textarea id="modalRelatoTexto" rows="3" placeholder="Descreva o que você percebeu..."></textarea>
                    <button class="btn-admin-action" style="margin-top:8px;" onclick="reportarProblema(${linha})">Enviar relato</button>
                </div>
            </div>
        `;
    }

    modalOverlay.style.display = 'flex';
}

function fecharModal() {
    document.getElementById('modalOverlay').style.display = 'none';
}

function fecharModalSeClicouFora(event) {
    if (event.target.id === 'modalOverlay') fecharModal();
}

async function salvarEdicaoExperimento(linha) {
    const nome = document.getElementById('modalEditNome').value.trim();
    const localizacao = document.getElementById('modalEditLocal').value;
    const componentes = document.getElementById('modalEditComp').value;
    const status = document.getElementById('modalEditStatus').value;

    if (!nome) { alert("O nome do experimento não pode ficar em branco."); return; }

    try {
        const area = await resolverCategoriaEscolhida('modalEditArea', 'modalNovaCategoriaNome', 'modalNovaCategoriaCor');
        await enviarParaPlanilha('Experimentos', 'editar', { linha, nome, area, localizacao, componentes, status });
        await carregarDados();
        fecharModal();
    } catch (err) {
        alert("Erro ao salvar alterações: " + err.message);
    }
}

async function reportarProblema(linha) {
    const descricao = document.getElementById('modalRelatoTexto').value.trim();
    if (!descricao) { alert("Descreva o problema antes de enviar."); return; }

    const hoje = new Date();
    const dataFormatada = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;

    try {
        await enviarParaPlanilha('Relatos', 'adicionar', { experimento_linha: linha, descricao, data: dataFormatada });
        alert("Obrigado! O relato foi enviado e será verificado pelo responsável do laboratório.");
        fecharModal();
    } catch (err) {
        alert("Erro ao enviar relato: " + err.message);
    }
}

// --- PAINEL ADMIN: RELATOS PENDENTES ---
function exibirRelatosPendentes() {
    const lista = document.getElementById('relatosPendentesList');
    const contador = document.getElementById('contadorRelatos');
    if (!lista || !contador) return;

    contador.textContent = relatos.length;

    if (relatos.length === 0) {
        lista.innerHTML = `<p style="font-size:13px; color:#7f8c8d;">Nenhum relato pendente.</p>`;
        return;
    }

    lista.innerHTML = relatos.map(r => {
        const exp = experimentos.find(e => String(e.linha) === String(r.experimento_linha));
        const nomeExp = exp ? exp.nome : `Experimento (linha ${r.experimento_linha})`;
        return `
            <div class="modal-relato-item">
                <strong>${nomeExp}</strong>
                <div>${r.descricao}</div>
                <div style="color:#7f8c8d; font-size:11px;">${r.data}</div>
                <div class="modal-relato-acoes">
                    <button class="btn-admin-action" onclick="confirmarRelato(${r.linha}, ${r.experimento_linha})">Confirmar defeito</button>
                    <button class="btn-icon" onclick="descartarRelato(${r.linha})">Descartar</button>
                </div>
            </div>
        `;
    }).join('');
}

async function confirmarRelato(linhaRelato, experimentoLinha) {
    try {
        await enviarParaPlanilha('Experimentos', 'mudarStatus', { linha: experimentoLinha, status: 'Com Defeito' });
        await enviarParaPlanilha('Relatos', 'remover', { linha: linhaRelato });
        await carregarDados();
        fecharModal();
    } catch (err) {
        alert("Erro ao confirmar relato: " + err.message);
    }
}

async function descartarRelato(linhaRelato) {
    if (!confirm("Descartar esse relato sem alterar o status do experimento?")) return;
    try {
        await enviarParaPlanilha('Relatos', 'remover', { linha: linhaRelato });
        await carregarDados();
    } catch (err) {
        alert("Erro ao descartar relato: " + err.message);
    }
}

// --- BARRA DE BUSCA ---
if (searchBar) {
    searchBar.addEventListener('input', (e) => {
        const termoBusca = e.target.value.toLowerCase();
        const filtrados = experimentos.filter(exp => {
            return exp.nome.toLowerCase().includes(termoBusca) || exp.area.toLowerCase().includes(termoBusca);
        });
        exibirExperimentos(filtrados);
    });
}
 
// --- ASSOCIAÇÃO DAS FUNÇÕES AO ESCOPO GLOBAL (WINDOW) ---
window.entrarComoAluno = entrarComoAluno;
window.mostrarTelaAuth = mostrarTelaAuth;
window.voltarParaInicio = voltarParaInicio;
window.alternarTab = alternarTab;
window.executarCadastro = executarCadastro;
window.executarLogin = executarLogin;
window.adicionarExperimentoNoGrid = adicionarExperimentoNoGrid;
window.removerExperimento = removerExperimento;
window.adicionarAvisoNoMural = adicionarAvisoNoMural;
window.removerAviso = removerAviso;
window.abrirModalExperimento = abrirModalExperimento;
window.fecharModal = fecharModal;
window.fecharModalSeClicouFora = fecharModalSeClicouFora;
window.salvarEdicaoExperimento = salvarEdicaoExperimento;
window.reportarProblema = reportarProblema;
window.confirmarRelato = confirmarRelato;
window.descartarRelato = descartarRelato;
