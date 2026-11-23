const MASTER_EMAIL = "gustavodesouzafirmino@gmail.com";
const MASTER_PASSWORD = "Administrador2030";
const MASTER_SERVER = "142536475869";
const SESSION_KEY = "receber-session";
const ACCOUNTS_KEY = "receber-accounts";
const ACCESS_KEY = "receber-access";

let currentServer = "";
let currentAccount = null;
let boletos = [];
let STORAGE_KEY = "";

function gerarEnderecoServidor() {
  const aleatorio = () => Math.floor(100000 + Math.random() * 900000).toString();
  return `${aleatorio()}${aleatorio()}`;
}

function lerContas() {
  return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "{}");
}

function salvarContas(contas) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(contas));
}

function iniciarSessao(server, account) {
  currentServer = server;
  currentAccount = account;
  STORAGE_KEY = `receber-boletos-${server}`;
  boletos = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  const asOfInput = document.querySelector("#dashboardAsOfDate");
  const todayKey = dashboardDateKey(new Date());
  asOfInput.max = todayKey;
  asOfInput.value = todayKey;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ server, account }));

  document.querySelector("#loginScreen").hidden = true;
  document.querySelector("#appShell").hidden = false;
  document.querySelector("#serverAddress").textContent = server;
  document.querySelector("#accountsSection").hidden = account.role !== "admin";
  document.querySelector("#accessSection").hidden = account.role !== "admin";
  document.querySelector("#backupSection").hidden = account.role !== "admin";
  document.querySelector("#dashboardNav").hidden = account.role !== "admin";
  document.querySelector(".sidebar-footer strong").textContent = account.name;
  document.querySelector(".sidebar-footer small").textContent = account.role === "admin" ? "Administrador" : "Usuário";
  document.querySelector(".avatar").textContent = account.name.split(" ").map((parte) => parte[0]).slice(0, 2).join("").toUpperCase();

  setView(account.role === "admin" ? "dashboard" : "todos");
  atualizarListaUsuarios();
  registrarAcesso(account);
  atualizarRegistrosAcessos();
}

function encerrarSessao() {
  sessionStorage.removeItem(SESSION_KEY);
  document.querySelector("#settingsModal").hidden = true;
  document.querySelector("#loginPassword").value = "";
  document.querySelector("#appShell").hidden = true;
  document.querySelector("#loginScreen").hidden = false;
}

function atualizarListaUsuarios() {
  if (!currentServer || currentAccount?.role !== "admin") return;
  const contas = lerContas();
  const usuarios = contas[currentServer]?.users || [];
  document.querySelector("#usersList").innerHTML = usuarios.length
    ? usuarios.map((usuario) => `<div class="user-row"><div><strong>${escapeHtml(usuario.name)}</strong><span>${escapeHtml(usuario.email)}</span></div><button type="button" class="icon-button delete" data-delete-user="${escapeHtml(usuario.email)}" aria-label="Excluir usuário">×</button></div>`).join("")
    : '<p class="users-empty">Nenhum usuário criado.</p>';
}

const THEME_KEY = "receber-theme";

let currentView = "todos";

const elements = {
  table: document.querySelector("#boletoTable"),
  empty: document.querySelector("#emptyState"),
  search: document.querySelector("#searchInput"),
  month: document.querySelector("#monthFilter"),
  modal: document.querySelector("#modalBackdrop"),
  form: document.querySelector("#boletoForm"),
  title: document.querySelector("#pageTitle"),
  toast: document.querySelector("#toast")
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function localDate(dateString) {
  if (!dateString) return null;
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function today() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function getStatus(boleto) {
  return getStatusAt(boleto, today());
}

function parseDateOnly(value) {
  if (!value) return null;
  const date = localDate(String(value).slice(0, 10));
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function getStatusAt(boleto, asOfDate) {
  const asOf = new Date(asOfDate);
  asOf.setHours(0, 0, 0, 0);
  const history = Array.isArray(boleto.historicoStatus) ? boleto.historicoStatus : [];
  const previousState = history
    .map((change) => ({ status: change.status, date: parseDateOnly(change.em || change.data || change.changedAt) }))
    .filter((change) => change.date && change.date <= asOf)
    .sort((a, b) => a.date - b.date)
    .pop();

  if (previousState?.status === "pago") return "pago";
  if (previousState) return getDueStatusAt(boleto, asOf);
  if (history.length) return getDueStatusAt(boleto, asOf);

  if (boleto.status === "pago") {
    const paidAt = parseDateOnly(boleto.dataPagamento);
    if (paidAt ? paidAt <= asOf : asOf >= today()) return "pago";
  }
  return getDueStatusAt(boleto, asOf);
}

function getDueStatusAt(boleto, asOfDate) {
  const due = parseDateOnly(boleto.vencimento);
  if (!due) return "a-vencer";
  const asOf = new Date(asOfDate);
  asOf.setHours(0, 0, 0, 0);
  return due < asOf ? "vencido" : "a-vencer";
}

function existedOnDate(boleto, asOfDate) {
  const createdAt = parseDateOnly(boleto.criadoEm);
  return !createdAt || createdAt <= asOfDate;
}

function formatDate(dateString) {
  const date = localDate(dateString);
  return date ? date.toLocaleDateString("pt-BR") : "—";
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(boletos));
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => elements.toast.classList.remove("show"), 2200);
}

function openModal(boleto = null) {
  elements.form.reset();
  document.querySelector("#boletoId").value = boleto?.id || "";
  document.querySelector("#modalTitle").textContent = boleto ? "Editar boleto" : "Adicionar boleto";

  if (boleto) {
    document.querySelector("#cliente").value = boleto.cliente;
    document.querySelector("#descricao").value = boleto.descricao;
    document.querySelector("#contato").value = boleto.contato || "";
    document.querySelector("#vencimento").value = boleto.vencimento;
    document.querySelector("#valor").value = boleto.valor;
    document.querySelector("#status").value = boleto.status;
    document.querySelector("#dataPagamento").value = boleto.dataPagamento || "";
  } else {
    document.querySelector("#vencimento").value = new Date().toISOString().slice(0, 10);
  }

  const statusInput = document.querySelector("#status");
  const dataPagamentoInput = document.querySelector("#dataPagamento");
  dataPagamentoInput.disabled = statusInput.value !== "pago";

  elements.modal.hidden = false;
  document.querySelector("#cliente").focus();
}

function closeModal() {
  elements.modal.hidden = true;
}

function updateMonthOptions() {
  const selected = elements.month.value;
  const dates = [...new Set(boletos.map((b) => b.vencimento?.slice(0, 7)).filter(Boolean))].sort().reverse();
  elements.month.innerHTML = '<option value="todos">Todos os meses</option>' + dates.map((date) => {
    const [year, month] = date.split("-");
    const name = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return `<option value="${date}">${name.charAt(0).toUpperCase() + name.slice(1)}</option>`;
  }).join("");
  if (["todos", ...dates].includes(selected)) elements.month.value = selected;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

function statusLabel(status) {
  return status === "pago" ? "Pago" : status === "vencido" ? "Vencido" : "A vencer";
}

function render() {
  atualizarListaClientes();
  updateMonthOptions();
  const search = elements.search.value.trim().toLowerCase();
  const month = elements.month.value;

  const filtered = boletos.filter((boleto) => {
    if (!matchesView(boleto, currentView)) return false;
    if (month !== "todos" && !boleto.vencimento?.startsWith(month)) return false;
    if (search && !`${boleto.cliente} ${boleto.descricao} ${boleto.contato}`.toLowerCase().includes(search)) return false;
    return true;
}).sort((a, b) => a.vencimento.localeCompare(b.vencimento));

  elements.table.innerHTML = filtered.map((boleto) => {
    const status = getStatus(boleto);
    const contact = boleto.contato
      ? `<span class="contact">${escapeHtml(boleto.contato)}</span>`
      : `<span class="contact">—</span>`;
    return `<tr>
      <td>${escapeHtml(boleto.cliente)}</td>
      <td>${escapeHtml(boleto.descricao)}</td>
      <td>${contact}</td>
      <td>${formatDate(boleto.vencimento)}</td>
      <td><strong>${currency.format(Number(boleto.valor) || 0)}</strong></td>
      <td><span class="status ${status}">${statusLabel(status)}</span></td>
      <td>
        <div class="actions">
          ${status !== "pago" ? `<button class="charge-button" data-action="charge" data-id="${boleto.id}">Cobrar</button><button class="icon-button" data-action="pay" data-id="${boleto.id}" title="Marcar como pago" aria-label="Marcar como pago"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16.5 8"/></svg></button>` : ""}
          <button class="icon-button" data-action="edit" data-id="${boleto.id}" title="Editar" aria-label="Editar"><svg viewBox="0 0 24 24"><path d="M4 20h4l11-11-4-4L4 16v4zM13 7l4 4"/></svg></button>
          <button class="icon-button delete" data-action="delete" data-id="${boleto.id}" title="Excluir" aria-label="Excluir"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg></button>
        </div>
      </td>
    </tr>`;
  }).join("");

  elements.empty.hidden = filtered.length !== 0;
  document.querySelector(".table-wrap").hidden = filtered.length === 0;
  renderSummary();
  renderChart();
}

function matchesView(boleto, view) {
  const status = getStatus(boleto);
  if (view === "todos" || view === "dashboard") return true;
  if (view === "em-aberto") return status !== "pago";
  if (view === "a-vencer") return status === "a-vencer";
  if (view === "vencidos") return status === "vencido";
  if (view === "pagos") return status === "pago";
  return false;
}

function dashboardDate(boleto, status = getStatus(boleto)) {
  const dateString = status === "pago" && boleto.dataPagamento
    ? boleto.dataPagamento
    : boleto.vencimento;
  const date = localDate(dateString);
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function dashboardDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDashboardRecords() {
  const period = document.querySelector("#dashboardPeriod").value;
  const dateInput = document.querySelector("#dashboardAsOfDate");
  const asOf = parseDateOnly(dateInput.value) || today();
  asOf.setHours(0, 0, 0, 0);
  const eligible = boletos.filter((boleto) => existedOnDate(boleto, asOf));
  if (period === "all") return { current: eligible, previous: null, period, asOf };

  const days = Number(period);
  const end = new Date(asOf);
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);

  const previousEnd = new Date(start);
  previousEnd.setDate(previousEnd.getDate() - 1);
  previousEnd.setHours(23, 59, 59, 999);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - days + 1);
  previousStart.setHours(0, 0, 0, 0);

  const current = [];
  const previous = [];
  eligible.forEach((boleto) => {
    const date = dashboardDate(boleto, getStatusAt(boleto, asOf));
    if (!date) return;
    if (date >= start && date <= end) current.push(boleto);
    else if (date >= previousStart && date <= previousEnd) previous.push(boleto);
  });
  return { current, previous, period, start, end, asOf };
}

function renderDonut(summary) {
  const total = summary.carteira;
  const categories = [
    { label: "Recebido", key: "recebido", color: "var(--emerald)", glow: "rgba(0,255,87,.58)", view: "pagos" },
    { label: "A vencer", key: "vencer", color: "var(--gold)", glow: "rgba(255,192,0,.54)", view: "a-vencer" },
    { label: "Vencido", key: "vencido", color: "var(--overdue)", glow: "rgba(255,23,68,.56)", view: "vencidos" }
  ];
  let start = 0;
  const stops = categories.map((category) => {
    const percent = total ? (summary.totals[category.key] / total) * 100 : 0;
    const stop = `${category.color} ${start}% ${start + percent}%`;
    start += percent;
    return stop;
  });
  const chart = document.querySelector("#donutChart");
  chart.style.background = total
    ? `conic-gradient(${stops.join(", ")})`
    : "conic-gradient(var(--chart-track) 0% 100%)";
  const dominant = total
    ? categories.reduce((largest, category) => (
      summary.totals[category.key] > summary.totals[largest.key] ? category : largest
    ))
    : null;
  chart.style.setProperty("--donut-glow", dominant?.glow || "transparent");
  chart.setAttribute("aria-label", total
    ? `Carteira de ${currency.format(total)}: recebido ${currency.format(summary.totals.recebido)}, a vencer ${currency.format(summary.totals.vencer)}, vencido ${currency.format(summary.totals.vencido)}.`
    : "Sem valores registrados no período.");
  document.querySelector("#donutCenterTotal").textContent = currency.format(total);
  document.querySelector("#donutCenterCount").textContent = `${summary.quantidade} registro(s)`;
  document.querySelector("#donutLegend").innerHTML = categories.map((category) => {
    const value = summary.totals[category.key];
    const count = summary.counts[category.key];
    const percent = total ? (value / total) * 100 : 0;
    return `<button type="button" class="donut-legend-item" data-view="${category.view}" title="Abrir registros: ${category.label}">
      <span class="legend-swatch ${category.key}"></span>
      <span class="legend-description"><strong>${category.label}</strong><small>${count} registro(s)</small><span class="legend-meter"><i class="${category.key}" style="width:${percent}%"></i></span></span>
      <span class="legend-amount"><strong>${currency.format(value)}</strong><small>${percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</small></span>
    </button>`;
  }).join("");
}

function summarizeRecords(records, asOfDate = today()) {
  const totals = { recebido: 0, aberto: 0, vencer: 0, vencido: 0 };
  const counts = { recebido: 0, aberto: 0, vencer: 0, vencido: 0 };

  records.forEach((boleto) => {
    const value = Number(boleto.valor) || 0;
    const status = getStatusAt(boleto, asOfDate);
    if (status === "pago") {
      totals.recebido += value;
      counts.recebido += 1;
    } else {
      totals.aberto += value;
      counts.aberto += 1;
      if (status === "vencido") {
        totals.vencido += value;
        counts.vencido += 1;
      } else {
        totals.vencer += value;
        counts.vencer += 1;
      }
    }
  });

  return {
    totals,
    counts,
    carteira: totals.recebido + totals.aberto,
    quantidade: records.length
  };
}

function updateTrend(element, currentValue, previousValue, previousCount, risesAreGood) {
  element.removeAttribute("data-direction");
  if (previousCount === null) {
    element.textContent = "Histórico total";
    element.title = "Selecione um período para comparar com a janela anterior.";
    return;
  }
  if (previousCount === 0) {
    element.textContent = currentValue > 0 ? "Novo no período" : "Sem base";
    element.title = "Não há registros na janela anterior para calcular uma variação.";
    element.dataset.direction = currentValue > 0 ? "neutral" : "neutral";
    return;
  }

  const difference = previousValue === 0 ? null : ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
  if (difference === null) {
    element.textContent = currentValue > 0 ? "Novo no período" : "0%";
    element.dataset.direction = "neutral";
    element.title = "O valor anterior era zero; não existe uma variação percentual calculável.";
    return;
  }

  const rounded = Math.abs(difference) < 0.05 ? 0 : difference;
  element.textContent = `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}%`;
  element.dataset.direction = rounded === 0 ? "neutral" : (rounded > 0) === risesAreGood ? "positive" : "negative";
  element.title = "Variação em relação à janela anterior, calculada com os registros disponíveis.";
}

function renderSummary() {
  const dashboardData = getDashboardRecords();
  const current = summarizeRecords(dashboardData.current, dashboardData.asOf);
  const previous = dashboardData.previous === null ? null : summarizeRecords(dashboardData.previous, dashboardData.asOf);
  const total = current.carteira;
  const rate = total ? (current.totals.recebido / total) * 100 : 0;
  const periodLabels = {
    "30": "Últimos 30 dias",
    "90": "Últimos 90 dias",
    "365": "Últimos 12 meses",
    all: "Todo o período"
  };

  document.querySelector("#totalPendente").textContent = currency.format(current.totals.aberto);
  document.querySelector("#totalAVencer").textContent = currency.format(current.totals.vencer);
  document.querySelector("#totalVencidos").textContent = currency.format(current.totals.vencido);
  document.querySelector("#totalPagos").textContent = currency.format(current.totals.recebido);
  document.querySelector("#receivedCount").textContent = `${current.counts.recebido} pagamento(s)`;
  document.querySelector("#openCount").textContent = `${current.counts.aberto} registro(s)`;
  document.querySelector("#overdueCount").textContent = `${current.counts.vencido} registro(s)`;
  document.querySelector("#dueCount").textContent = `${current.counts.vencer} registro(s)`;
  document.querySelector("#totalPortfolio").textContent = currency.format(total);
  document.querySelector("#recordCount").textContent = `${current.quantidade} registro(s)`;
  document.querySelector("#collectionRate").textContent = `${rate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  document.querySelector("#collectionRateMeta").textContent = total
    ? `${currency.format(current.totals.recebido)} recebido`
    : "Sem valores no período";
  document.querySelector("#dashboardUpdated").textContent = new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
  document.querySelector("#dashboardPeriodPrintLabel").textContent =
    `${periodLabels[dashboardData.period]} · Situação em ${formatDate(dashboardDateKey(dashboardData.asOf))}`;

  updateTrend(
    document.querySelector("#receivedTrend"),
    current.totals.recebido,
    previous?.totals.recebido || 0,
    previous?.counts.recebido ?? null,
    true
  );
  updateTrend(
    document.querySelector("#pendingTrend"),
    current.totals.aberto,
    previous?.totals.aberto || 0,
    previous?.counts.aberto ?? null,
    false
  );
  updateTrend(
    document.querySelector("#overdueTrend"),
    current.totals.vencido,
    previous?.totals.vencido || 0,
    previous?.counts.vencido ?? null,
    false
  );
  updateTrend(
    document.querySelector("#dueTrend"),
    current.totals.vencer,
    previous?.totals.vencer || 0,
    previous?.counts.vencer ?? null,
    false
  );

  renderDonut(current);
}

function excelCell(value, style = 0) {
  return { value, style };
}

function excelColumnName(index) {
  let name = "";
  let number = index + 1;
  while (number > 0) {
    const remainder = (number - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    number = Math.floor((number - 1) / 26);
  }
  return name;
}

function xmlEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;"
  })[character]);
}

function createWorksheetXml(rows, options = {}) {
  const headerRow = options.headerRow || 0;
  const maxColumns = options.columnCount || Math.max(1, ...rows.map((row) => row.length));
  const lastColumn = excelColumnName(maxColumns - 1);
  const sheetRows = rows.map((row, rowIndex) => {
    const entries = Array.from({ length: maxColumns }, (_, columnIndex) => (
      row[columnIndex] ?? (options.defaultStyle ? { value: "", style: options.defaultStyle } : undefined)
    ));
    const cells = entries.map((entry, columnIndex) => {
      const cell = entry && typeof entry === "object" && Object.prototype.hasOwnProperty.call(entry, "value")
        ? entry
        : { value: entry, style: options.defaultStyle || 0 };
      const reference = `${excelColumnName(columnIndex)}${rowIndex + 1}`;
      const style = cell.style ? ` s="${cell.style}"` : "";
      if (cell.value === null || cell.value === undefined || cell.value === "") {
        return cell.style ? `<c r="${reference}"${style}/>` : "";
      }
      if (typeof cell.value === "number" && Number.isFinite(cell.value)) {
        return `<c r="${reference}"${style}><v>${cell.value}</v></c>`;
      }
      return `<c r="${reference}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEscape(cell.value)}</t></is></c>`;
    }).join("");
    const height = rowIndex === 0 && options.title ? ' ht="28" customHeight="1"' : "";
    return `<row r="${rowIndex + 1}"${height}>${cells}</row>`;
  }).join("");
  const columns = (options.widths || []).map((width, index) => (
    `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`
  )).join("");
  const frozenPane = options.freezeRows
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${options.freezeRows}" topLeftCell="A${options.freezeRows + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  const autoFilter = options.headerRow && rows.length > options.headerRow
    ? `<autoFilter ref="A${options.headerRow}:${lastColumn}${rows.length}"/>`
    : "";
  const mergeCells = options.mergeCells?.length
    ? `<mergeCells count="${options.mergeCells.length}">${options.mergeCells.map((range) => `<mergeCell ref="${range}"/>`).join("")}</mergeCells>`
    : "";
  const relationshipNamespace = options.drawing
    ? ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
    : "";
  const drawing = options.drawing ? '<drawing r:id="rId1"/>' : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"${relationshipNamespace}>
  ${frozenPane}
  <sheetFormatPr defaultRowHeight="19"/>
  ${columns ? `<cols>${columns}</cols>` : ""}
  <sheetData>${sheetRows}</sheetData>
  ${autoFilter}
  ${mergeCells}
  <pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
  ${drawing}
</worksheet>`;
}

function createExcelStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00;[Red]-&quot;R$&quot; #,##0.00"/></numFmts>
  <fonts count="7">
    <font><sz val="11"/><color rgb="FF202821"/><name val="Aptos"/></font>
    <font><b/><color rgb="FFFFFFFF"/><name val="Aptos"/></font>
    <font><b/><sz val="16"/><color rgb="FFFFD000"/><name val="Aptos Display"/></font>
    <font><b/><sz val="13"/><color rgb="FF00FF57"/><name val="Aptos Display"/></font>
    <font><b/><sz val="13"/><color rgb="FFFFC000"/><name val="Aptos Display"/></font>
    <font><b/><sz val="13"/><color rgb="FFFF1744"/><name val="Aptos Display"/></font>
    <font><sz val="10"/><color rgb="FFD8E1DB"/><name val="Aptos"/></font>
  </fonts>
  <fills count="7">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF07351F"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF07100A"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF00521F"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF503500"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF4A0A18"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="14">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="4" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="3" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="5" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="4" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="6" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="5" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="10" fontId="3" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="6" fillId="3" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZipBlob(files) {
  const encoder = new TextEncoder();
  const chunks = [];
  const centralDirectory = [];
  const date = new Date();
  const zipTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const zipDate = ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  let offset = 0;

  files.forEach((file) => {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const checksum = crc32(data);
    const localHeader = new Uint8Array(30);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, zipTime, true);
    localView.setUint16(12, zipDate, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, name.length, true);
    localView.setUint16(28, 0, true);
    chunks.push(localHeader, name, data);

    const directoryHeader = new Uint8Array(46);
    const directoryView = new DataView(directoryHeader.buffer);
    directoryView.setUint32(0, 0x02014b50, true);
    directoryView.setUint16(4, 20, true);
    directoryView.setUint16(6, 20, true);
    directoryView.setUint16(8, 0x0800, true);
    directoryView.setUint16(10, 0, true);
    directoryView.setUint16(12, zipTime, true);
    directoryView.setUint16(14, zipDate, true);
    directoryView.setUint32(16, checksum, true);
    directoryView.setUint32(20, data.length, true);
    directoryView.setUint32(24, data.length, true);
    directoryView.setUint16(28, name.length, true);
    directoryView.setUint16(30, 0, true);
    directoryView.setUint16(32, 0, true);
    directoryView.setUint16(34, 0, true);
    directoryView.setUint16(36, 0, true);
    directoryView.setUint32(38, 0, true);
    directoryView.setUint32(42, offset, true);
    centralDirectory.push(directoryHeader, name);
    offset += localHeader.length + name.length + data.length;
  });

  const directoryLength = centralDirectory.reduce((length, part) => length + part.length, 0);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, directoryLength, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  return new Blob([...chunks, ...centralDirectory, endRecord], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function exportExcelReport() {
  const dashboardData = getDashboardRecords();
  const { current, period, asOf } = dashboardData;
  const summary = summarizeRecords(current, asOf);
  const labels = {
    "30": "Últimos 30 dias",
    "90": "Últimos 90 dias",
    "365": "Últimos 12 meses",
    all: "Todo o período"
  };
  const generatedAt = new Date().toLocaleString("pt-BR");
  const clientMap = new Map();

  current.forEach((boleto) => {
    const name = (boleto.cliente || "Cliente não informado").trim();
    const key = name.toLocaleLowerCase("pt-BR");
    const client = clientMap.get(key) || {
      name,
      contact: "",
      count: 0,
      paid: 0,
      open: 0,
      overdue: 0,
      total: 0,
      receivedAmount: 0,
      openAmount: 0,
      overdueAmount: 0
    };
    const value = Number(boleto.valor) || 0;
    const status = getStatusAt(boleto, asOf);
    client.contact = boleto.contato || client.contact;
    client.count += 1;
    client.total += value;
    if (status === "pago") {
      client.paid += 1;
      client.receivedAmount += value;
    } else {
      client.open += 1;
      client.openAmount += value;
      if (status === "vencido") {
        client.overdue += 1;
        client.overdueAmount += value;
      }
    }
    clientMap.set(key, client);
  });

  const summaryRows = [
    [excelCell("RELATÓRIO FINANCEIRO", 4)],
    ["Período", labels[period]],
    ["Situação em", formatDate(dashboardDateKey(asOf))],
    ["Gerado em", generatedAt],
    [],
    [excelCell("Indicador", 1), excelCell("Quantidade", 1), excelCell("Valor", 1)],
    ["Registros", summary.quantidade, ""],
    ["Pagamentos realizados", summary.counts.recebido, excelCell(summary.totals.recebido, 2)],
    ["Em aberto", summary.counts.aberto, excelCell(summary.totals.aberto, 2)],
    ["A vencer", summary.counts.vencer, excelCell(summary.totals.vencer, 2)],
    ["Vencidos", summary.counts.vencido, excelCell(summary.totals.vencido, 2)],
    ["Carteira total", "", excelCell(summary.carteira, 2)],
    ["Percentual recebido", "", excelCell(summary.carteira ? summary.totals.recebido / summary.carteira : 0, 3)]
  ];
  const clientsRows = [[
    excelCell("Cliente", 1),
    excelCell("Contato", 1),
    excelCell("Boletos", 1),
    excelCell("Pagos", 1),
    excelCell("Em aberto", 1),
    excelCell("Vencidos", 1),
    excelCell("Valor total", 1),
    excelCell("Recebido", 1),
    excelCell("Em aberto (R$)", 1),
    excelCell("Vencido (R$)", 1)
  ]];
  [...clientMap.values()]
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .forEach((client) => clientsRows.push([
      client.name,
      client.contact,
      client.count,
      client.paid,
      client.open,
      client.overdue,
      excelCell(client.total, 2),
      excelCell(client.receivedAmount, 2),
      excelCell(client.openAmount, 2),
      excelCell(client.overdueAmount, 2)
    ]));

  const billsRows = [[
    excelCell("Cliente", 1),
    excelCell("Contato", 1),
    excelCell("Descrição", 1),
    excelCell("Vencimento", 1),
    excelCell("Status", 1),
    excelCell("Data de pagamento", 1),
    excelCell("Valor", 1)
  ], ...current
    .slice()
    .sort((a, b) => (a.cliente || "").localeCompare(b.cliente || "", "pt-BR") || (a.vencimento || "").localeCompare(b.vencimento || ""))
    .map((boleto) => [
      boleto.cliente || "",
      boleto.contato || "",
      boleto.descricao || "",
      formatDate(boleto.vencimento),
      statusLabel(getStatusAt(boleto, asOf)),
      boleto.dataPagamento ? formatDate(boleto.dataPagamento) : "—",
      excelCell(Number(boleto.valor) || 0, 2)
    ])];

  const sheetNames = ["Resumo", "Clientes", "Boletos"];
  const worksheets = [
    createWorksheetXml(summaryRows, { title: true, headerRow: 6, widths: [32, 24, 22] }),
    createWorksheetXml(clientsRows, { headerRow: 1, freezeRows: 1, widths: [30, 30, 12, 12, 14, 12, 20, 20, 20, 20] }),
    createWorksheetXml(billsRows, { headerRow: 1, freezeRows: 1, widths: [30, 30, 36, 16, 16, 20, 20] })
  ];
  const sheetOverrides = worksheets.map((_, index) => (
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  )).join("");
  const workbookSheets = sheetNames.map((name, index) => (
    `<sheet name="${name}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
  )).join("");
  const sheetRelationships = worksheets.map((_, index) => (
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  )).join("");

  const files = [
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheetOverrides}</Types>`
    },
    {
      name: "_rels/.rels",
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetRelationships}<Relationship Id="rId${worksheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
    },
    { name: "xl/styles.xml", content: createExcelStylesXml() },
    ...worksheets.map((content, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, content }))
  ];
  const blob = createZipBlob(files);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Relatorio_Receber_${dashboardDateKey(new Date())}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function setView(view) {
  if (view === "dashboard" && currentAccount?.role !== "admin") view = "todos";
  currentView = view;
  const titles = {
    dashboard: "Dashboard",
    todos: "Todos os boletos",
    "em-aberto": "Em aberto",
    "a-vencer": "A vencer",
    vencidos: "Vencidos",
    pagos: "Pagos"
  };
  elements.title.textContent = titles[view];
  document.querySelector("#dashboardView").hidden = view !== "dashboard";
  document.querySelector("#billsView").hidden = view === "dashboard";
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  document.querySelector(".sidebar").classList.remove("open");
  render();
}

function atualizarListaClientes() {
  const clientes = [...new Map(
    boletos
      .filter((boleto) => boleto.cliente)
      .map((boleto) => [boleto.cliente.trim().toLowerCase(), boleto])
  ).values()].sort((a, b) => a.cliente.localeCompare(b.cliente, "pt-BR"));

  document.querySelector("#listaClientes").innerHTML = clientes
    .map((boleto) => `<option value="${escapeHtml(boleto.cliente)}"></option>`)
    .join("");
}

function preencherContatoDoCliente() {
  const nome = document.querySelector("#cliente").value.trim().toLowerCase();
  if (!nome) return;

  const clienteExistente = [...boletos]
    .reverse()
    .find((boleto) => boleto.cliente?.trim().toLowerCase() === nome && boleto.contato);

  if (clienteExistente) {
    document.querySelector("#contato").value = clienteExistente.contato;
  }
}

function abrirCobranca(boleto) {
  const valor = currency.format(Number(boleto.valor) || 0);
  const vencimento = formatDate(boleto.vencimento);
  const mensagem = `Olá, ${boleto.cliente}! Gostaria de lembrar sobre o boleto referente a ${boleto.descricao}, no valor de ${valor}, com vencimento em ${vencimento}.`;
  const contato = (boleto.contato || "").trim();

  if (contato.includes("@")) {
    const assunto = encodeURIComponent(`Cobrança — ${boleto.descricao}`);
    const texto = encodeURIComponent(mensagem);
    window.location.href = `mailto:${encodeURIComponent(contato)}?subject=${assunto}&body=${texto}`;
    return;
  }

  const telefone = contato.replace(/\D/g, "");
  if (telefone) {
    const numero = telefone.startsWith("55") ? telefone : `55${telefone}`;
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`, "_blank", "noopener");
    return;
  }

  showToast("Cadastre telefone ou email para cobrar");
}

function getDashboardChartData(dashboardData) {
  const { current, period, start, asOf } = dashboardData;
  const buckets = [];
  let heading;
  let periodLabel;

  if (period === "30") {
    heading = "Movimentação diária";
    periodLabel = "30 DIAS";
    const firstDay = new Date(start);
    for (let index = 0; index < 30; index += 1) {
      const date = new Date(firstDay);
      date.setDate(firstDay.getDate() + index);
      buckets.push({
        key: dashboardDateKey(date),
        label: String(date.getDate()),
        title: date.toLocaleDateString("pt-BR", { day: "numeric", month: "long" })
      });
    }
  } else {
    heading = "Movimentação mensal";
    periodLabel = period === "90" ? "90 DIAS" : period === "365" ? "365 DIAS" : "12 MESES RECENTES";
    const firstMonth = period === "all"
      ? new Date(asOf.getFullYear(), asOf.getMonth() - 11, 1)
      : new Date(start.getFullYear(), start.getMonth(), 1);
    const lastMonth = new Date(asOf.getFullYear(), asOf.getMonth(), 1);
    for (const date = firstMonth; date <= lastMonth; date.setMonth(date.getMonth() + 1)) {
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      buckets.push({
        key,
        label: date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        title: date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
      });
    }
  }

  const totals = new Map(buckets.map((bucket) => [bucket.key, { recebido: 0, vencer: 0, vencido: 0 }]));
  current.forEach((boleto) => {
    const date = dashboardDate(boleto, getStatusAt(boleto, asOf));
    if (!date) return;
    const key = period === "30"
      ? dashboardDateKey(date)
      : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const bucket = totals.get(key);
    if (!bucket) return;
    const status = getStatusAt(boleto, asOf);
    const category = status === "pago" ? "recebido" : status === "vencido" ? "vencido" : "vencer";
    bucket[category] += Number(boleto.valor) || 0;
  });
  return { buckets, values: buckets.map((bucket) => totals.get(bucket.key)), heading, periodLabel };
}

function renderChart() {
  const dashboardData = getDashboardRecords();
  const { period } = dashboardData;
  const { buckets, values, heading, periodLabel } = getDashboardChartData(dashboardData);
  const graph = document.querySelector("#chartGraph");
  document.querySelector("#chartHeading").textContent = heading;
  document.querySelector("#chartPeriodLabel").textContent = periodLabel;
  const maximum = Math.max(0, ...values.flatMap(Object.values));
  const scale = maximum ? maximum * 1.15 : 0;
  document.querySelector("#chartYLabels").innerHTML = [1, .75, .5, .25, 0]
    .map((part) => `<span>${currency.format(scale * part)}</span>`)
    .join("");

  const left = 34;
  const right = 986;
  const top = 18;
  const bottom = 216;
  const x = (index) => buckets.length < 2
    ? (left + right) / 2
    : left + (index / (buckets.length - 1)) * (right - left);
  const y = (amount) => bottom - (scale ? (amount / scale) * (bottom - top) : 0);
  const series = [
    { key: "recebido", label: "Recebido", className: "received-series", areaClass: "received-area" },
    { key: "vencer", label: "A vencer", className: "due-series", areaClass: "due-area" },
    { key: "vencido", label: "Vencido", className: "overdue-series", areaClass: "overdue-area" }
  ];
  const activeSeries = series.filter((item) => values.some((value) => value[item.key] > 0));
  const hasActivity = activeSeries.length > 0;
  const pointsFor = (key) => values.map((value, index) => ({ x: x(index), y: y(value[key]), amount: value[key] }));
  const pathFor = (points) => {
    if (!points.length) return "";
    return points.reduce((path, point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`;
      const previous = points[index - 1];
      const control = (point.x - previous.x) / 3;
      return `${path} C ${previous.x + control} ${previous.y}, ${point.x - control} ${point.y}, ${point.x} ${point.y}`;
    }, "");
  };
  const areaFor = (points) => {
    if (!points.length) return "";
    return `${pathFor(points)} L ${points[points.length - 1].x} ${bottom} L ${points[0].x} ${bottom} Z`;
  };
  const lineMarkup = activeSeries.map((item) => {
    const points = pointsFor(item.key);
    const line = pathFor(points);
    const markers = points.map((point, index) => (
      `<circle class="chart-point ${item.className}" cx="${point.x}" cy="${point.y}" r="3.2"><title>${buckets[index].title} · ${item.label}: ${currency.format(point.amount)}</title></circle>`
    )).join("");
    return `<path class="series-line ${item.className}" d="${line}"><title>${item.label}</title></path>${markers}`;
  }).join("");
  const areaMarkup = activeSeries.map((item) => (
    `<path class="${item.areaClass}" d="${areaFor(pointsFor(item.key))}"/>`
  )).join("");
  const gridLines = [0, .25, .5, .75, 1].map((part) => {
    const lineY = top + part * (bottom - top);
    return `<line class="chart-gridline" x1="${left}" y1="${lineY}" x2="${right}" y2="${lineY}"/>`;
  }).join("");
  document.querySelector("#chartEmptyState").hidden = hasActivity;

  const plotWidth = buckets.length * (period === "30" ? 34 : 44);
  graph.style.minWidth = `${plotWidth}px`;
  document.querySelector("#chartXLabels").style.minWidth = `${plotWidth}px`;
  document.querySelector("#chartXLabels").style.gridTemplateColumns = `repeat(${buckets.length}, minmax(0, 1fr))`;
  document.querySelector("#chartXLabels").innerHTML = buckets.map((bucket) => (
    `<span title="${bucket.title}">${bucket.label}</span>`
  )).join("");
  graph.setAttribute("aria-label", `Movimentação ${period === "30" ? "diária" : "mensal"} de recebidos, a vencer e vencidos.`);
  graph.innerHTML = `<defs>
    <linearGradient id="receivedFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#00ff57" stop-opacity=".48"/>
      <stop offset="68%" stop-color="#00ff57" stop-opacity=".2"/>
      <stop offset="100%" stop-color="#00ff57" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="dueFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffc000" stop-opacity=".42"/>
      <stop offset="100%" stop-color="#ffc000" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="overdueFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ff1744" stop-opacity=".44"/>
      <stop offset="100%" stop-color="#ff1744" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="receivedStroke" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#00d944"/>
      <stop offset="48%" stop-color="#00ff57"/>
      <stop offset="100%" stop-color="#8aff9f"/>
    </linearGradient>
    <filter id="receivedGlow" x="-35%" y="-70%" width="170%" height="240%">
      <feGaussianBlur stdDeviation="4.5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="dueGlow" x="-35%" y="-70%" width="170%" height="240%">
      <feGaussianBlur stdDeviation="2.5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="overdueGlow" x="-35%" y="-70%" width="170%" height="240%">
      <feGaussianBlur stdDeviation="2.5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  ${gridLines}
  ${areaMarkup}
  ${lineMarkup}`;
}

function aplicarTema(theme) {
  const isDark = theme === "dark";
  document.body.classList.toggle("dark-theme", isDark);
  localStorage.setItem(THEME_KEY, theme);
  document.querySelectorAll(".theme-option").forEach((option) => {
    const selected = option.dataset.theme === theme;
    option.classList.toggle("selected", selected);
    option.setAttribute("aria-checked", String(selected));
  });
}

const temaSalvo = localStorage.getItem(THEME_KEY) || "dark";
aplicarTema(temaSalvo);

document.querySelector("#openSettings").addEventListener("click", () => {
  document.querySelector(".sidebar").classList.remove("open");
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
  document.querySelector("#openSettings").classList.add("active");
  document.querySelector("#settingsModal").hidden = false;
});

document.querySelector("#closeSettings").addEventListener("click", () => {
  document.querySelector("#settingsModal").hidden = true;
  document.querySelector("#openSettings").classList.remove("active");
  document.querySelectorAll(".nav-item[data-view]").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === currentView);
  });
});

document.querySelector("#settingsModal").addEventListener("click", (event) => {
  if (event.target === document.querySelector("#settingsModal")) {
    document.querySelector("#closeSettings").click();
  }
});

document.querySelectorAll(".theme-option").forEach((option) => {
  option.addEventListener("click", () => {
    aplicarTema(option.dataset.theme);
    showToast(option.dataset.theme === "dark" ? "Tema escuro ativado" : "Tema claro ativado");
  });
});

document.querySelector("#openModal").addEventListener("click", () => openModal());
document.querySelector("#emptyAdd").addEventListener("click", () => openModal());
document.querySelector("#closeModal").addEventListener("click", closeModal);
document.querySelector("#cancelModal").addEventListener("click", closeModal);
elements.modal.addEventListener("click", (event) => { if (event.target === elements.modal) closeModal(); });
elements.search.addEventListener("input", render);
elements.month.addEventListener("change", render);

document.querySelector("#menuButton").addEventListener("click", () => document.querySelector(".sidebar").classList.toggle("open"));
document.querySelectorAll(".nav-item[data-view]").forEach((item) => item.addEventListener("click", () => setView(item.dataset.view)));
document.querySelector("#dashboardPeriod").addEventListener("change", render);
document.querySelector("#dashboardAsOfDate").addEventListener("change", render);
document.querySelector("#dashboardToday").addEventListener("click", () => {
  const date = document.querySelector("#dashboardAsOfDate");
  date.value = dashboardDateKey(new Date());
  render();
});

const dashboardView = document.querySelector("#dashboardView");
const fullscreenToggle = document.querySelector("#fullscreenToggle");
fullscreenToggle.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement === dashboardView) {
      await document.exitFullscreen();
      return;
    }
    if (typeof dashboardView.requestFullscreen !== "function") {
      throw new Error("Tela cheia não é compatível com este navegador.");
    }
    await dashboardView.requestFullscreen();
  } catch (error) {
    console.error("Não foi possível alternar para tela cheia:", error);
    showToast(error instanceof Error ? error.message : "Não foi possível abrir a dashboard em tela cheia.");
  }
});
document.addEventListener("fullscreenchange", () => {
  const isFullscreen = document.fullscreenElement === dashboardView;
  fullscreenToggle.setAttribute("aria-pressed", String(isFullscreen));
  fullscreenToggle.querySelector("span").textContent = isFullscreen ? "Sair da tela cheia" : "Tela cheia";
  fullscreenToggle.title = isFullscreen ? "Sair da apresentação" : "Abrir a dashboard em tela cheia";
});

const exportMenuToggle = document.querySelector("#exportMenuToggle");
const exportMenu = document.querySelector("#exportMenu");
function closeExportMenu() {
  exportMenu.hidden = true;
  exportMenuToggle.setAttribute("aria-expanded", "false");
}
exportMenuToggle.addEventListener("click", () => {
  exportMenu.hidden = !exportMenu.hidden;
  exportMenuToggle.setAttribute("aria-expanded", String(!exportMenu.hidden));
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".export-control")) closeExportMenu();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeExportMenu();
});
document.querySelector("#exportPdf").addEventListener("click", () => {
  closeExportMenu();
  window.print();
});
document.querySelector("#exportExcel").addEventListener("click", () => {
  closeExportMenu();
  try {
    exportExcelReport();
    showToast("Planilha Excel com resumo, clientes e boletos baixada");
  } catch (error) {
    console.error("Não foi possível gerar a planilha Excel:", error);
    showToast("Não foi possível gerar a planilha Excel.");
  }
});
document.querySelector("#donutLegend").addEventListener("click", (event) => {
  const item = event.target.closest("[data-view]");
  if (item) setView(item.dataset.view);
});

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const id = document.querySelector("#boletoId").value;
  const existing = id ? boletos.find((item) => item.id === id) : null;
  const changedAt = dashboardDateKey(new Date());
  const boleto = {
    id: id || crypto.randomUUID(),
    cliente: document.querySelector("#cliente").value.trim(),
    descricao: document.querySelector("#descricao").value.trim(),
    contato: document.querySelector("#contato").value.trim(),
    vencimento: document.querySelector("#vencimento").value,
    valor: Number(document.querySelector("#valor").value),
    status: document.querySelector("#status").value,
    dataPagamento: document.querySelector("#status").value === "pago"
      ? document.querySelector("#dataPagamento").value
      : "",
    criadoEm: existing ? existing.criadoEm : changedAt,
    historicoStatus: Array.isArray(existing?.historicoStatus) ? [...existing.historicoStatus] : []
  };

  if (id) {
    if (!boleto.historicoStatus.length) {
      boleto.historicoStatus.push({
        status: existing.status,
        em: existing.criadoEm || existing.dataPagamento || changedAt
      });
    }
    if (existing.status !== boleto.status || existing.dataPagamento !== boleto.dataPagamento) {
      boleto.historicoStatus.push({ status: boleto.status, em: changedAt });
    }
    boletos = boletos.map((item) => item.id === id ? boleto : item);
    showToast("Boleto atualizado");
  } else {
    boleto.historicoStatus.push({ status: boleto.status, em: changedAt });
    boletos.push(boleto);
    showToast("Boleto cadastrado");
  }
  save();
  closeModal();
  render();
});

elements.table.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const boleto = boletos.find((item) => item.id === button.dataset.id);
  if (!boleto) return;

  if (button.dataset.action === "charge") abrirCobranca(boleto);
  if (button.dataset.action === "edit") openModal(boleto);
  if (button.dataset.action === "pay") {
    const changedAt = dashboardDateKey(new Date());
    const data = prompt("Informe a data do pagamento:", changedAt);
    if (!data) return;
    if (!Array.isArray(boleto.historicoStatus) || !boleto.historicoStatus.length) {
      boleto.historicoStatus = [{
        status: boleto.status,
        em: boleto.criadoEm || changedAt
      }];
    }
    boleto.historicoStatus.push({ status: "pago", em: changedAt });
    boleto.status = "pago";
    boleto.dataPagamento = data;
    save();
    showToast("Boleto marcado como pago");
    render();
  }
  if (button.dataset.action === "delete") {
    if (confirm(`Excluir o boleto de ${boleto.cliente}?`)) {
      boletos = boletos.filter((item) => item.id !== boleto.id);
      save();
      showToast("Boleto excluído");
      render();
    }
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.modal.hidden) closeModal();
});

document.querySelector("#cliente").addEventListener("input", preencherContatoDoCliente);
document.querySelector("#cliente").addEventListener("change", preencherContatoDoCliente);
document.querySelector("#status").addEventListener("change", (event) => {
  const dataPagamento = document.querySelector("#dataPagamento");
  dataPagamento.disabled = event.target.value !== "pago";
  if (event.target.value === "pago" && !dataPagamento.value) {
    dataPagamento.value = new Date().toISOString().slice(0, 10);
  }
  if (event.target.value !== "pago") dataPagamento.value = "";
});

document.querySelector("#loginForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const email = document.querySelector("#loginEmail").value.trim().toLowerCase();
  const password = document.querySelector("#loginPassword").value;
  let server = document.querySelector("#loginServer").value.trim();
  const error = document.querySelector("#loginError");

  if (!server) {
    server = gerarEnderecoServidor();
  }

  const contas = lerContas();
  let account = null;

  if (email === MASTER_EMAIL && password === MASTER_PASSWORD) {
    server = document.querySelector("#loginServer").value.trim() || MASTER_SERVER;
    if (!contas[server]) contas[server] = { users: [] };
    salvarContas(contas);
    account = { name: "Gustavo Souza", email: MASTER_EMAIL, role: "admin" };
  } else {
    const registro = contas[server];
    const usuario = registro?.users?.find((item) => item.email.toLowerCase() === email && item.password === password);
    if (!usuario) {
      error.textContent = "Gmail, senha ou endereço do servidor inválido.";
      return;
    }
    account = { name: usuario.name, email: usuario.email, role: "user" };
  }

  error.textContent = "";
  iniciarSessao(server, account);
});

document.querySelector("#openUserModal").addEventListener("click", () => {
  document.querySelector("#userForm").reset();
  document.querySelector("#userModal").hidden = false;
  document.querySelector("#userName").focus();
});

function fecharModalUsuario() { document.querySelector("#userModal").hidden = true; }
document.querySelector("#closeUserModal").addEventListener("click", fecharModalUsuario);
document.querySelector("#cancelUserModal").addEventListener("click", fecharModalUsuario);

document.querySelector("#userForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!currentServer || currentAccount?.role !== "admin") return;

  const email = document.querySelector("#userEmail").value.trim().toLowerCase();
  const usuario = {
    name: document.querySelector("#userName").value.trim(),
    email,
    password: document.querySelector("#userPassword").value
  };

  const contas = lerContas();
  contas[currentServer] ||= { users: [] };
  if (contas[currentServer].users.some((item) => item.email.toLowerCase() === email)) {
    showToast("Este Gmail já possui uma conta neste servidor");
    return;
  }

  contas[currentServer].users.push(usuario);
  salvarContas(contas);
  fecharModalUsuario();
  atualizarListaUsuarios();
  showToast("Conta de usuário criada");
});

document.querySelector("#usersList").addEventListener("click", (event) => {
  const botao = event.target.closest("[data-delete-user]");
  if (!botao) return;
  if (!confirm("Excluir esta conta de usuário?")) return;

  const contas = lerContas();
  contas[currentServer].users = contas[currentServer].users.filter((item) => item.email !== botao.dataset.deleteUser);
  salvarContas(contas);
  atualizarListaUsuarios();
  showToast("Conta excluída");
});

document.querySelector("#copyServer").addEventListener("click", async () => {
  await navigator.clipboard.writeText(currentServer);
  showToast("Endereço copiado");
});

function lerBoletosDoBackup(backup) {
  if (backup?.format !== "receber-backup" || backup.version !== 1) {
    throw new Error("Este arquivo não é um backup compatível do Receber.");
  }
  const itens = backup.data?.ticketsByServer?.[currentServer];
  if (!Array.isArray(itens)) {
    throw new Error(`O backup não contém boletos para o endereço ${currentServer}.`);
  }

  return itens.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`O boleto ${index + 1} do arquivo está inválido.`);
    }
    const valor = Number(item.valor);
    if (
      typeof item.cliente !== "string" ||
      typeof item.descricao !== "string" ||
      typeof item.vencimento !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(item.vencimento) ||
      !Number.isFinite(valor) ||
      valor <= 0 ||
      !["pendente", "pago"].includes(item.status)
    ) {
      throw new Error(`O boleto ${index + 1} do arquivo está inválido.`);
    }

    const criadoEmDate = parseDateOnly(item.criadoEm);
    const historicoStatus = Array.isArray(item.historicoStatus)
      ? item.historicoStatus
        .filter((change) => {
          if (!change || !["pendente", "pago"].includes(change.status) || typeof change.em !== "string") return false;
          const date = parseDateOnly(change.em);
          return date && dashboardDateKey(date) === change.em;
        })
        .map((change) => ({ status: change.status, em: change.em }))
      : [];

    return {
      id: typeof item.id === "string" && item.id ? item.id : crypto.randomUUID(),
      cliente: item.cliente,
      descricao: item.descricao,
      contato: typeof item.contato === "string" ? item.contato : "",
      vencimento: item.vencimento,
      valor,
      status: item.status,
      dataPagamento: typeof item.dataPagamento === "string" ? item.dataPagamento : "",
      criadoEm: criadoEmDate ? dashboardDateKey(criadoEmDate) : "",
      historicoStatus
    };
  });
}

async function importarBackup(file) {
  if (!currentServer || currentAccount?.role !== "admin") {
    throw new Error("Somente o administrador pode importar boletos.");
  }

  let backup;
  try {
    backup = JSON.parse(await file.text());
  } catch {
    throw new Error("Não foi possível ler o arquivo JSON.");
  }

  const importados = lerBoletosDoBackup(backup);
  const idsExistentes = new Set(boletos.map((boleto) => boleto.id));
  const novos = importados.filter((boleto) => {
    if (idsExistentes.has(boleto.id)) return false;
    idsExistentes.add(boleto.id);
    return true;
  });
  const duplicados = importados.length - novos.length;
  if (!novos.length) {
    showToast("Todos os boletos desse backup já estão cadastrados.");
    return;
  }

  const mensagem = `Serão adicionados ${novos.length} boleto(s). ${duplicados} já existente(s) serão ignorados; os dados atuais não serão apagados. Deseja continuar?`;
  if (!confirm(mensagem)) return;

  boletos = [...boletos, ...novos];
  save();
  atualizarListaClientes();
  render();
  showToast(`${novos.length} boleto(s) importado(s)`);
}

function criarBackup() {
  if (!currentServer || currentAccount?.role !== "admin") {
    throw new Error("Somente o administrador pode exportar o backup.");
  }
  return {
    format: "receber-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      theme: localStorage.getItem(THEME_KEY) || "dark",
      ticketsByServer: { [currentServer]: boletos }
    }
  };
}

function baixarBackup() {
  const conteudo = JSON.stringify(criarBackup(), null, 2);
  const blob = new Blob([conteudo], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `receber-backup-${hojeISO()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Backup JSON exportado");
}

document.querySelector("#exportBackup").addEventListener("click", () => {
  try {
    baixarBackup();
  } catch (error) {
    showToast(error instanceof Error ? error.message : "Não foi possível exportar o backup.");
  }
});

document.querySelector("#importBackup").addEventListener("change", async (event) => {
  const input = event.currentTarget;
  const file = input.files?.[0];
  if (!file) return;
  try {
    await importarBackup(file);
  } catch (error) {
    showToast(error instanceof Error ? error.message : "Não foi possível importar o backup.");
  } finally {
    input.value = "";
  }
});

document.querySelector("#logoutButton").addEventListener("click", encerrarSessao);

document.querySelector("#userModal").addEventListener("click", (event) => {
  if (event.target === document.querySelector("#userModal")) fecharModalUsuario();
});

const sessaoSalva = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
if (sessaoSalva?.server && sessaoSalva?.account) {
  iniciarSessao(sessaoSalva.server, sessaoSalva.account);
}

render();
atualizarListaClientes();

function hojeISO() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function registrarAcesso(account) {
  if (!currentServer || !account) return;
  const registros = JSON.parse(localStorage.getItem(ACCESS_KEY) || "{}");
  registros[currentServer] ||= { users: {}, sessions: {} };

  const email = account.email.toLowerCase();
  registros[currentServer].users[email] ||= { name: account.name, email, role: account.role, lastSeen: "", days: {} };
  const usuario = registros[currentServer].users[email];
  const dia = hojeISO();
  const agora = new Date().toISOString();

  usuario.lastSeen = agora;
  usuario.days[dia] ||= 0;
  usuario.days[dia] += 1;

  registros[currentServer].sessions[crypto.randomUUID()] = {
    email,
    name: account.name,
    role: account.role,
    startedAt: agora,
    active: true
  };

  localStorage.setItem(ACCESS_KEY, JSON.stringify(registros));
}

function atualizarRegistrosAcessos() {
  if (!currentServer || currentAccount?.role !== "admin") return;
  const registros = JSON.parse(localStorage.getItem(ACCESS_KEY) || "{}");
  const dados = registros[currentServer] || { users: {}, sessions: {} };
  const contas = lerContas();
  const usuariosCriados = contas[currentServer]?.users?.length || 0;

  const hoje = hojeISO();
  const agora = Date.now();
  const limiteOnline = 10 * 60 * 1000;
  const usuarios = Object.values(dados.users);
  const sessoesAtivas = Object.values(dados.sessions).filter((sessao) => {
    const visto = Date.parse(sessao.startedAt || 0);
    return sessao.active && agora - visto < limiteOnline;
  });
  const acessosHoje = usuarios.reduce((total, usuario) => total + (usuario.days?.[hoje] || 0), 0);

  document.querySelector("#totalUsers").textContent = String(usuariosCriados + 1);
  document.querySelector("#onlineUsers").textContent = String(sessoesAtivas.length);
  document.querySelector("#todayAccesses").textContent = String(acessosHoje);

  const usuariosOrdenados = usuarios.sort((a, b) => Date.parse(b.lastSeen || 0) - Date.parse(a.lastSeen || 0));
  document.querySelector("#accessList").innerHTML = usuariosOrdenados.length
    ? usuariosOrdenados.map((usuario) => {
        const ultimo = usuario.lastSeen ? new Date(usuario.lastSeen).toLocaleString("pt-BR") : "Ainda não acessou";
        const online = sessoesAtivas.some((sessao) => sessao.email === usuario.email);
        const hojeCount = usuario.days?.[hoje] || 0;
        return `<div class="user-row access-row">
          <div class="access-person"><span class="access-dot ${online ? "online" : ""}"></span><div class="access-info"><strong>${escapeHtml(usuario.name)}</strong><span>${escapeHtml(usuario.email)}</span></div></div>
          <div class="access-count"><strong>${hojeCount} hoje</strong><br>Último: ${escapeHtml(ultimo)}</div>
        </div>`;
      }).join("")
    : '<p class="users-empty">Nenhum acesso registrado.</p>';
}
