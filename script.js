// =======================================================
// CONFIGURAÇÃO: cole aqui a URL do seu Apps Script publicado
// (Implantar -> Nova implantação -> App da Web -> copiar URL)
// =======================================================
const URL_SCRIPT = "https://script.google.com/macros/s/AKfycbxj1fi240YGOO1_eyU7jp_Z4QDYdHgkakA9r2ecDA1IvyDeULH96y7vlBP3gBWrPQQO/exec";
 
let experimentos = [];
let avisos = [];
let relatos = [];
let categorias = [];
let configSistema = { modo_inventario: 'inativo', ultimo_inventario_data: '' };
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
        if (usuarioLogado) { exibirRelatosPendentes(); exibirRoteirosCadastrados(); }
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
verificarModoInventario();

// --- CONTROLE DE NAVEGAÇÃO ---
function entrarComoAluno() {
    if (configSistema.modo_inventario === 'ativo') {
        alert("O laboratório está fazendo o inventário físico agora. Tente novamente mais tarde.");
        return;
    }
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
            exibirPainelModoInventario();
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

// --- MODO INVENTÁRIO (bloqueia consulta pública durante a contagem física) ---
async function verificarModoInventario() {
    try {
        configSistema = await buscarDaPlanilha('Config');
    } catch (err) {
        console.error('Erro ao checar modo inventário:', err);
        return;
    }

    const aviso = document.getElementById('avisoInventario');
    const btnAluno = document.getElementById('btnSouAluno');
    if (!aviso || !btnAluno) return;

    if (configSistema.modo_inventario === 'ativo') {
        aviso.style.display = 'block';
        aviso.innerHTML = `<div style="background:#fdedec; color:#c0392b; padding:12px 16px; border-radius:8px; margin-bottom:16px; font-size:14px;">
            🔒 O laboratório está fazendo o inventário físico agora. A consulta de estudante fica temporariamente indisponível.
        </div>`;
        btnAluno.disabled = true;
        btnAluno.style.opacity = '0.5';
        btnAluno.style.cursor = 'not-allowed';
    } else {
        aviso.style.display = 'none';
        btnAluno.disabled = false;
        btnAluno.style.opacity = '1';
        btnAluno.style.cursor = 'pointer';
    }
}

function exibirPainelModoInventario() {
    const painel = document.getElementById('painelModoInventario');
    if (!painel) return;

    if (configSistema.modo_inventario === 'ativo') {
        painel.innerHTML = `
            <p style="font-size:13px; color:#c0392b; font-weight:600;">🔒 Inventário em andamento — consulta de estudante está bloqueada.</p>
            <button class="btn-admin-action" onclick="encerrarModoInventario()">✅ Encerrar Inventário</button>
            <button class="btn-icon btn-icon-excluir" style="width:100%; margin-top:8px; padding:8px;" onclick="cancelarModoInventario()">❌ Cancelar Inventário</button>
        `;
    } else {
        const ultimaData = configSistema.ultimo_inventario_data
            ? `<p style="font-size:12px; color:#7f8c8d;">Último inventário concluído em: ${configSistema.ultimo_inventario_data}</p>`
            : '';
        painel.innerHTML = `
            <p style="font-size:13px; color:#7f8c8d;">Ative pra bloquear a consulta pública enquanto vocês conferem o inventário físico.</p>
            ${ultimaData}
            <button class="btn-admin-action" onclick="ativarModoInventario()">🔒 Iniciar Inventário</button>
        `;
    }
}

async function ativarModoInventario() {
    const chave = prompt("Digite a chave mestra do laboratório pra confirmar:");
    if (chave === null) return;

    try {
        await enviarParaPlanilha('Config', 'ativarInventario', { chave });
        await verificarModoInventario();
        exibirPainelModoInventario();
        exibirExperimentos(experimentos);
        alert("Modo Inventário ativado. A consulta de estudante está bloqueada até você encerrar.");
    } catch (err) {
        alert("Erro ao ativar: " + err.message);
    }
}

async function encerrarModoInventario() {
    if (!confirm("Confirma que o inventário foi concluído? Isso libera a consulta de estudante de novo.")) return;

    const hoje = new Date();
    const dataFormatada = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;

    try {
        await enviarParaPlanilha('Config', 'encerrarInventario', { data: dataFormatada });
        await verificarModoInventario();
        exibirPainelModoInventario();
        exibirExperimentos(experimentos);
    } catch (err) {
        alert("Erro ao encerrar: " + err.message);
    }
}

async function cancelarModoInventario() {
    if (!confirm("Cancelar o Modo Inventário sem registrar conclusão?")) return;

    try {
        await enviarParaPlanilha('Config', 'cancelarInventario', {});
        await verificarModoInventario();
        exibirPainelModoInventario();
        exibirExperimentos(experimentos);
    } catch (err) {
        alert("Erro ao cancelar: " + err.message);
    }
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
// --- AGRUPAMENTO POR TIPO (uma linha da planilha = uma unidade física) ---
function chaveDoGrupo(exp) {
    const norm = (t) => (t || '').toString().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim();
    return norm(exp.nome) + '||' + norm(exp.area);
}

// Ordem de gravidade: o card agrupado mostra sempre o status mais crítico do grupo
const PRIORIDADE_STATUS = ['Com Defeito', 'Em Reparo', 'Desativado', 'Ativo'];

function agruparExperimentos(lista) {
    const mapa = new Map();
    lista.forEach(exp => {
        const chave = chaveDoGrupo(exp);
        if (!mapa.has(chave)) mapa.set(chave, { ...exp, unidades: [] });
        mapa.get(chave).unidades.push(exp);
    });

    return Array.from(mapa.values()).map(grupo => {
        const statusDasUnidades = grupo.unidades.map(u => u.status || 'Ativo');
        const statusResumo = PRIORIDADE_STATUS.find(s => statusDasUnidades.includes(s)) || 'Ativo';
        const contagem = {};
        statusDasUnidades.forEach(s => { contagem[s] = (contagem[s] || 0) + 1; });
        return { ...grupo, statusResumo, contagem, linhas: grupo.unidades.map(u => u.linha) };
    });
}

function seloDeStatus(status) {
    if (status === 'Em Reparo') return `<span class="status-badge status-reparo">🛠️ Em Reparo</span>`;
    if (status === 'Com Defeito') return `<span class="status-badge status-defeito">⚠️ Com Defeito</span>`;
    if (status === 'Desativado') return `<span class="status-badge status-desativado">🚫 Desativado</span>`;
    return `<span class="status-badge status-ativo">✅ Ativo</span>`;
}

function montarMiniatura(exp, cor, idUnico) {
    if (!exp.imagem_url) return '';
    return `<img src="${exp.imagem_url}" alt="${exp.nome}" class="card-thumb" onerror="this.style.display='none';">`;
}

function exibirExperimentos(lista) {
    grid.innerHTML = '';
    if (lista.length === 0) {
        grid.innerHTML = '<div class="no-results">Nenhum experimento encontrado.</div>';
        return;
    }

    const modoInventario = configSistema.modo_inventario === 'ativo';

    // No modo inventário cada unidade física aparece sozinha; fora dele, agrupa por tipo
    const itens = modoInventario
        ? lista.map(exp => ({ ...exp, unidades: [exp], linhas: [exp.linha] }))
        : agruparExperimentos(lista);

    itens.forEach(item => {
        const card = document.createElement('div');
        const cor = corCategoria(item.area);
        const qtd = item.unidades.length;
        const statusExibido = modoInventario ? (item.status || 'Ativo') : item.statusResumo;

        card.className = `card card-clicavel${statusExibido === 'Desativado' ? ' card-desativado' : ''}`;
        card.style.borderTopColor = cor;
        card.onclick = () => modoInventario
            ? abrirModalExperimento(item.linha)
            : abrirModalGrupo(chaveDoGrupo(item));

        const acoesAdmin = usuarioLogado ? `
            <div class="card-header-actions">
                ${item.manual_url ? `<a href="${item.manual_url}" target="_blank" rel="noopener" class="btn-icon" title="Abrir manual" onclick="event.stopPropagation();">📄</a>` : ''}
                <button class="btn-icon btn-icon-excluir" onclick="event.stopPropagation(); ${modoInventario ? `removerExperimento(${item.linha})` : `removerGrupo('${chaveDoGrupo(item)}')`}" title="${modoInventario ? 'Remover esta unidade' : 'Remover todas as unidades'}">🗑️</button>
            </div>
        ` : '';

        // No modo inventário o patrimônio vira selo, do lado do status
        const seloPatrimonio = modoInventario
            ? `<span class="status-badge status-patrimonio">🏷️ ${item.patrimonio || 'sem nº'}</span>`
            : '';

        // Fora do inventário, um grupo com várias unidades mostra a contagem
        let linhaQuantidade = '';
        if (!modoInventario && qtd > 1) {
            const problemas = (item.contagem['Com Defeito'] || 0) + (item.contagem['Em Reparo'] || 0);
            linhaQuantidade = `<p class="info-item"><span class="info-label">Unidades:</span> ${qtd}${problemas ? ` <span style="color:#c0392b;">(${problemas} com problema)</span>` : ''}</p>`;
        }

        const idUnico = modoInventario ? item.linha : chaveDoGrupo(item).replace(/[^a-z0-9]/g, '');

        card.innerHTML = `
            ${montarMiniatura(item, cor, idUnico)}
            <div>
                ${acoesAdmin}
                <div class="card-top-row">
                    <span class="badge" style="background-color:${cor}22; color:${cor}; border:1px solid ${cor}55;">${item.area || 'Não Definida'}</span>
                    <span style="display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end;">${seloPatrimonio}${seloDeStatus(statusExibido)}</span>
                </div>
                <h3 style="margin: 5px 0 15px 0; color: var(--primary-color); font-size:16px;">${item.nome}</h3>
                ${linhaQuantidade}
                <p class="info-item"><span class="info-label">Localização:</span> ${item.localizacao || 'Não cadastrada'}</p>
                <p class="info-item"><span class="info-label">Componentes:</span> ${item.componentes || 'Não catalogados'}</p>
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
        const quantidade = parseInt(document.getElementById('expQuantidade').value, 10) || 1;
        const patrimonio = document.getElementById('expPatrimonio').value.trim();
        await enviarParaPlanilha('Experimentos', 'adicionar', { nome, area, localizacao, componentes, quantidade, patrimonio });
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
 

// --- MODAL DE GRUPO (card agrupado, fora do modo inventário) ---
function abrirModalGrupo(chave) {
    const unidades = experimentos.filter(e => chaveDoGrupo(e) === chave);
    if (unidades.length === 0) return;

    const ref = unidades[0]; // representante do grupo (campos compartilhados)
    const modalOverlay = document.getElementById('modalOverlay');
    const modalConteudo = document.getElementById('modalConteudo');

    const listaUnidades = unidades.map(u => `
        <div class="modal-relato-item" style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <span>🏷️ ${u.patrimonio || '<em style="color:#7f8c8d;">sem nº</em>'}</span>
            ${seloDeStatus(u.status || 'Ativo')}
        </div>
    `).join('');

    if (usuarioLogado) {
        const opcoesArea = opcoesDeCategoria(ref.area);
        modalConteudo.innerHTML = `
            <button class="modal-fechar" onclick="fecharModal()">✕</button>
            <h3>${ref.nome}</h3>
            <p style="font-size:13px; color:#7f8c8d; margin-top:-8px;">${unidades.length} unidade(s) cadastrada(s)</p>

            <div class="form-group">
                <label for="grupoEditNome">Nome do experimento</label>
                <input type="text" id="grupoEditNome" value="${ref.nome.replace(/"/g, '&quot;')}">
            </div>
            <div class="form-group">
                <label for="grupoEditArea">Área</label>
                <select id="grupoEditArea">${opcoesArea}</select>
            </div>
            <div class="form-group" id="grupoNovaCategoriaBloco" style="display:none;">
                <label for="grupoNovaCategoriaNome">Nome da nova categoria</label>
                <input type="text" id="grupoNovaCategoriaNome" placeholder="Ex: Robótica">
                <label for="grupoNovaCategoriaCor" style="margin-top:6px;">Cor da categoria</label>
                <input type="color" id="grupoNovaCategoriaCor" value="#3498db" style="height:38px; padding:2px;">
            </div>
            <div class="form-group">
                <label for="grupoEditLocal">Localização</label>
                <input type="text" id="grupoEditLocal" value="${(ref.localizacao || '').replace(/"/g, '&quot;')}">
            </div>
            <div class="form-group">
                <label for="grupoEditComp">Componentes</label>
                <input type="text" id="grupoEditComp" value="${(ref.componentes || '').replace(/"/g, '&quot;')}">
            </div>
            <div class="form-group">
                <label for="grupoEditImagem">Link da imagem (Google Drive)</label>
                <input type="text" id="grupoEditImagem" value="${(ref.imagem_url || '').replace(/"/g, '&quot;')}">
            </div>
            <div class="form-group">
                <label for="grupoEditManual">Link do manual — visível só para professores</label>
                <input type="text" id="grupoEditManual" value="${(ref.manual_url || '').replace(/"/g, '&quot;')}">
            </div>
            <div class="form-group">
                <label for="grupoEditRoteiro">Link do roteiro</label>
                <input type="text" id="grupoEditRoteiro" value="${(ref.roteiro_url || '').replace(/"/g, '&quot;')}">
            </div>
            <p style="font-size:12px; color:#7f8c8d;">Salvar aplica estes campos a todas as ${unidades.length} unidade(s). Status e patrimônio são editados individualmente no Modo Inventário.</p>
            <button class="btn-admin-action" onclick="salvarEdicaoGrupo('${chave}')">Salvar alterações</button>

            <div class="modal-secao">
                <h4>Unidades deste experimento</h4>
                ${listaUnidades}
            </div>
        `;
        configurarSelectCategoria('grupoEditArea', 'grupoNovaCategoriaBloco');
    } else {
        const blocoImagem = ref.imagem_url
            ? `<img src="${ref.imagem_url}" alt="${ref.nome}" style="width:100%; border-radius:8px; margin-bottom:14px;" onerror="this.style.display='none'">`
            : '';
        modalConteudo.innerHTML = `
            <button class="modal-fechar" onclick="fecharModal()">✕</button>
            <h3>${ref.nome}</h3>
            ${blocoImagem}
            <p class="info-item"><span class="info-label">Área:</span> ${ref.area || 'Não definida'}</p>
            <p class="info-item"><span class="info-label">Localização:</span> ${ref.localizacao || 'Não cadastrada'}</p>
            <p class="info-item"><span class="info-label">Componentes:</span> ${ref.componentes || 'Não catalogados'}</p>
            <p class="info-item"><span class="info-label">Unidades:</span> ${unidades.length}</p>

            <div class="modal-secao">
                <h4>Situação das unidades</h4>
                ${listaUnidades}
            </div>

            <div class="modal-secao">
                <div class="form-group">
                    <label for="modalRelatoTexto">Reportar problema com este experimento</label>
                    <textarea id="modalRelatoTexto" rows="3" placeholder="Descreva o que você percebeu (informe o nº de patrimônio, se souber)..."></textarea>
                    <button class="btn-admin-action" style="margin-top:8px;" onclick="reportarProblema(${ref.linha})">Enviar relato</button>
                </div>
            </div>
        `;
    }

    modalOverlay.style.display = 'flex';
}

async function salvarEdicaoGrupo(chave) {
    const unidades = experimentos.filter(e => chaveDoGrupo(e) === chave);
    if (unidades.length === 0) return;

    const nome = document.getElementById('grupoEditNome').value.trim();
    if (!nome) { alert("O nome do experimento não pode ficar em branco."); return; }

    const dados = {
        linhas: unidades.map(u => u.linha),
        nome,
        localizacao: document.getElementById('grupoEditLocal').value,
        componentes: document.getElementById('grupoEditComp').value,
        imagem_url: document.getElementById('grupoEditImagem').value.trim(),
        manual_url: document.getElementById('grupoEditManual').value.trim(),
        roteiro_url: document.getElementById('grupoEditRoteiro').value.trim(),
    };

    try {
        dados.area = await resolverCategoriaEscolhida('grupoEditArea', 'grupoNovaCategoriaNome', 'grupoNovaCategoriaCor');
        await enviarParaPlanilha('Experimentos', 'editarGrupo', dados);
        await carregarDados();
        fecharModal();
    } catch (err) {
        alert("Erro ao salvar alterações: " + err.message);
    }
}

async function removerGrupo(chave) {
    const unidades = experimentos.filter(e => chaveDoGrupo(e) === chave);
    if (unidades.length === 0) return;

    if (!confirm(`Remover TODAS as ${unidades.length} unidade(s) de "${unidades[0].nome}" do inventário?`)) return;

    try {
        await enviarParaPlanilha('Experimentos', 'removerGrupo', { linhas: unidades.map(u => u.linha) });
        await carregarDados();
    } catch (err) {
        alert("Erro ao remover: " + err.message);
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
                <label for="modalEditImagem">Link da imagem (Google Drive)</label>
                <input type="text" id="modalEditImagem" placeholder="https://drive.google.com/uc?export=view&id=..." value="${(exp.imagem_url || '').replace(/"/g, '&quot;')}">
            </div>
            <div class="form-group">
                <label for="modalEditManual">Link do manual (PDF no Drive) — visível só para professores</label>
                <input type="text" id="modalEditManual" placeholder="https://drive.google.com/file/d/.../view" value="${(exp.manual_url || '').replace(/"/g, '&quot;')}">
            </div>
            <div class="form-group">
                <label for="modalEditRoteiro">Link do roteiro (PDF no Drive) — aparece na lista de Roteiros</label>
                <input type="text" id="modalEditRoteiro" placeholder="https://drive.google.com/file/d/.../view" value="${(exp.roteiro_url || '').replace(/"/g, '&quot;')}">
            </div>
            <div class="form-group">
                <label for="modalEditPatrimonio">Nº de patrimônio (desta unidade)</label>
                <input type="text" id="modalEditPatrimonio" value="${(exp.patrimonio || '').replace(/"/g, '&quot;')}">
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
        const blocoImagem = exp.imagem_url
            ? `<img src="${exp.imagem_url}" alt="${exp.nome}" style="width:100%; border-radius:8px; margin-bottom:14px;" onerror="this.style.display='none'">`
            : '';

        modalConteudo.innerHTML = `
            <button class="modal-fechar" onclick="fecharModal()">✕</button>
            <h3>${exp.nome}</h3>
            ${blocoImagem}
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
    const imagem_url = document.getElementById('modalEditImagem').value.trim();
    const manual_url = document.getElementById('modalEditManual').value.trim();
    const roteiro_url = document.getElementById('modalEditRoteiro').value.trim();
    const status = document.getElementById('modalEditStatus').value;
    const patrimonio = document.getElementById('modalEditPatrimonio').value.trim();

    if (!nome) { alert("O nome do experimento não pode ficar em branco."); return; }

    try {
        const area = await resolverCategoriaEscolhida('modalEditArea', 'modalNovaCategoriaNome', 'modalNovaCategoriaCor');
        await enviarParaPlanilha('Experimentos', 'editar', { linha, nome, area, localizacao, componentes, imagem_url, manual_url, roteiro_url, status, patrimonio });
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
function exibirRoteirosCadastrados() {
    const lista = document.getElementById('roteirosCadastradosList');
    const contador = document.getElementById('contadorRoteiros');
    if (!lista || !contador) return;

    const comRoteiro = experimentos.filter(e => e.roteiro_url);
    contador.textContent = comRoteiro.length;

    if (comRoteiro.length === 0) {
        lista.innerHTML = `<p style="font-size:13px; color:#7f8c8d;">Nenhum roteiro cadastrado ainda.</p>`;
        return;
    }

    lista.innerHTML = comRoteiro.map(e => `
        <div class="modal-relato-item" style="display:flex; justify-content:space-between; align-items:center;">
            <strong>${e.nome}</strong>
            <a href="${e.roteiro_url}" target="_blank" rel="noopener" class="btn-admin-action" style="padding:4px 10px; font-size:12px; text-decoration:none;">Abrir</a>
        </div>
    `).join('');
}

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
window.ativarModoInventario = ativarModoInventario;
window.encerrarModoInventario = encerrarModoInventario;
window.cancelarModoInventario = cancelarModoInventario;
window.abrirModalGrupo = abrirModalGrupo;
window.salvarEdicaoGrupo = salvarEdicaoGrupo;
window.removerGrupo = removerGrupo;
