"use client";

import { useMemo, useState, useEffect } from "react";
import { useStore, Employee, SalaryHistory } from "@/store/useStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Mail,
  Copy,
  Printer,
  FileText,
  Settings,
  Settings2,
  Check,
} from "lucide-react";

// Empresas pagadoras
const EMPRESAS = {
  CASANA: { razao: "BUDDY & GENECY CONSTRUTORA LTDA", cnpj: "50.251.097/0001-83" },
  BUDDY: { razao: "GENECY CONSTRUÇÕES E SERVIÇOS LTDA", cnpj: "45.689.000/0001-89" },
};

// Tipos de email
const EMAIL_TYPES = [
  { k: "admissao", t: "Admissão (registro)" },
  { k: "pedido_com", t: "Pedido de demissão — com aviso" },
  { k: "pedido_sem", t: "Pedido de demissão — sem aviso" },
  { k: "empresa_com", t: "Demissão pela empresa — com aviso" },
  { k: "empresa_sem", t: "Demissão pela empresa — sem aviso (indenizado)" },
  { k: "aumento", t: "Aumento salarial" },
];

export default function EmailsPage() {
  const { employees, attendance, salaryHistory } = useStore();

  const activeEmployees = useMemo(() => {
    return [...employees].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [employees]);

  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const [emailType, setEmailType] = useState<string>("admissao");
  const [emailObs, setEmailObs] = useState<string>("");
  const [monthStr, setMonthStr] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );

  const [copySuccess, setCopySuccess] = useState<"formatted" | "plain" | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Configuração contabilidade e assinatura
  const [config, setConfig] = useState({
    contabilidade: "Foxtrot",
    signatario: "Felipe Moura | Coordenador de Compras e Administrativo",
    cargaHoraria: "44 horas semanais",
    horario1: "Segunda a quinta-feira: 07:00 às 12:00 / 13:00 às 17:00",
    horario2: "Sexta-feira: 07:00 às 12:00 / 13:00 às 16:00",
  });

  useEffect(() => {
    const saved = localStorage.getItem("rh_emails_config");
    if (saved) {
      try {
        setConfig(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Selecionar primeiro funcionário por padrão
  useEffect(() => {
    if (activeEmployees.length > 0 && !selectedEmpId) {
      setSelectedEmpId(activeEmployees[0].id);
    }
  }, [activeEmployees, selectedEmpId]);

  const saveConfig = (key: keyof typeof config, value: string) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    localStorage.setItem("rh_emails_config", JSON.stringify(newConfig));
  };

  const selectedEmp = useMemo(() => {
    return employees.find((e) => e.id === selectedEmpId) || null;
  }, [employees, selectedEmpId]);

  // Helpers de formatação
  const formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) return "—";
    const onlyDate = dateStr.slice(0, 10);
    const parts = onlyDate.split("-");
    if (parts.length < 3) return "—";
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const formatDateLong = (dateStr: string | undefined): string => {
    if (!dateStr) return "—";
    const onlyDate = dateStr.slice(0, 10);
    const parts = onlyDate.split("-").map(Number);
    if (parts.length < 3 || parts.some(isNaN)) return "—";
    const [y, m, d] = parts;
    const meses = [
      "janeiro",
      "fevereiro",
      "março",
      "abril",
      "maio",
      "junho",
      "julho",
      "agosto",
      "setembro",
      "outubro",
      "novembro",
      "dezembro",
    ];
    return `${String(d).padStart(2, "0")} de ${meses[m - 1]} de ${y}`;
  };

  const formatCurrency = (val: number | null | undefined): string => {
    if (val === null || val === undefined || isNaN(val)) return "—";
    return val.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const calcLastWorkDate = (emp: Employee): string => {
    // Caso seja demissão empresa com aviso
    if (emp.dismissal_type === "empresa_com" && emp.notice_end_date) {
      const d = new Date(emp.notice_end_date + "T12:00:00Z");
      d.setDate(d.getDate() - 7);
      return d.toISOString().split("T")[0];
    }
    // Caso seja aviso funcionario (pedido com aviso)
    if (emp.dismissal_type === "pedido_com" && emp.notice_start_date) {
      const d = new Date(emp.notice_start_date + "T12:00:00Z");
      d.setDate(d.getDate() + 30);
      return d.toISOString().split("T")[0];
    }
    // Demissão sem aviso
    if ((emp.dismissal_type === "pedido_sem" || emp.dismissal_type === "empresa_sem") && emp.dismissal_date) {
      return emp.dismissal_date;
    }
    return "";
  };

  // Cálculo de faltas
  const getAbsencesText = (employeeId: string, ym: string) => {
    const faltas: number[] = [];
    const justificadas: number[] = [];

    Object.keys(attendance).forEach((date) => {
      if (date.startsWith(ym)) {
        const dayNum = parseInt(date.split("-")[2], 10);
        const record = attendance[date]?.[employeeId];
        const status = typeof record === "object" ? record?.status : record;

        if (status === "absence") {
          faltas.push(dayNum);
        } else if (status === "justified_absence") {
          justificadas.push(dayNum);
        }
      }
    });

    faltas.sort((a, b) => a - b);
    justificadas.sort((a, b) => a - b);

    const monthNum = ym.split("-")[1];
    const fmt = (arr: number[]) =>
      arr.map((d) => `${String(d).padStart(2, "0")}/${monthNum}`).join(", ");

    const [y, m] = ym.split("-").map(Number);
    const meses = [
      "Janeiro",
      "Fevereiro",
      "Março",
      "Abril",
      "Maio",
      "Junho",
      "Julho",
      "Agosto",
      "Setembro",
      "Outubro",
      "Novembro",
      "Dezembro",
    ];
    const label = `${meses[m - 1]} / ${y}`;

    let s = `Relatório de presença/faltas de ${label}: `;
    if (faltas.length === 0 && justificadas.length === 0) {
      s += "o funcionário não teve faltas no período.";
    } else {
      const parts = [];
      if (faltas.length > 0) parts.push(`${faltas.length} falta(s) (dias ${fmt(faltas)})`);
      if (justificadas.length > 0)
        parts.push(
          `${justificadas.length} falta(s) justificada(s) por atestado (dias ${fmt(justificadas)})`
        );
      s += parts.join(" e ") + ".";
    }
    return s;
  };

  // Montagem do E-mail (HTML e Texto)
  const emailContent = useMemo(() => {
    if (!selectedEmp) return null;

    const emp = EMPRESAS[selectedEmp.pagador || "CASANA"];
    const cab = `${emp.razao}, inscrita no CNPJ nº ${emp.cnpj}`;
    const obs = emailObs ? `\n\nObservação: ${emailObs}` : "";
    const obsHtml = emailObs ? `<p><b>Observação:</b> ${emailObs}</p>` : "";
    const faltasText = getAbsencesText(selectedEmp.id, monthStr);

    if (emailType === "admissao") {
      const assunto = `REGISTRO – ${selectedEmp.name}`;
      const html = `
        <p>Prezados da ${config.contabilidade},</p>
        <p>Solicito o registro do funcionário abaixo informado em nossa empresa <b>${emp.razao}</b>, inscrita no <b>CNPJ nº ${emp.cnpj}</b>.</p>
        <p>Seguem, em anexo, as cópias dos documentos necessários para o processo de admissão.</p>
        <div class="blk"><span class="lab-blk">Dados do funcionário:</span><br>
          <b>Nome:</b> ${selectedEmp.name}<br>
          <b>Função:</b> ${selectedEmp.role || "—"}<br>
          <b>Tipo de salário:</b> Fixo mensal<br>
          <b>Salário líquido:</b> ${formatCurrency(selectedEmp.salary)}</div>
        <p><i>Informo que o valor acima já contempla o rateio de todos os benefícios, incluindo vale-refeição e demais benefícios aplicáveis.</i></p>
        <div class="blk"><span class="lab-blk">Dados da admissão:</span><br>
          <b>Data de admissão:</b> ${formatDateLong(selectedEmp.admission_date)}<br>
          <b>Carga horária:</b> ${config.cargaHoraria}</div>
        <p><b>Horário de trabalho:</b><br>${config.horario1}<br>${config.horario2}</p>
        <p><i>Por favor, nos enviem os documentos necessários para admissão.</i><br>
        <i>Fico à disposição caso seja necessária alguma informação adicional.</i></p>
        <p>Atenciosamente,<br>${config.signatario}</p>
      `;

      const text = `Prezados da ${config.contabilidade},

Solicito o registro do funcionário abaixo informado em nossa empresa ${cab}.

Seguem, em anexo, as cópias dos documentos necessários para o processo de admissão.

Dados do funcionário:
Nome: ${selectedEmp.name}
Função: ${selectedEmp.role || "—"}
Tipo de salário: Fixo mensal
Salário líquido: ${formatCurrency(selectedEmp.salary)}

Informo que o valor acima já contempla o rateio de todos os benefícios, incluindo vale-refeição e demais benefícios aplicáveis.

Dados da admissão:
Data de admissão: ${formatDateLong(selectedEmp.admission_date)}
Carga horária: ${config.cargaHoraria}

Horário de trabalho:
${config.horario1}
${config.horario2}

Por favor, nos enviem os documentos necessários para admissão.
Fico à disposição caso seja necessária alguma informação adicional.

Atenciosamente,
${config.signatario}`;

      return { assunto, html, text };
    }

    if (emailType === "aumento") {
      const empHistory = salaryHistory
        .filter((s) => s.employee_id === selectedEmp.id)
        .sort(
          (a, b) =>
            new Date(b.effective_date).getTime() -
            new Date(a.effective_date).getTime()
        );
      const ult = empHistory[0];

      const assunto = `ALTERAÇÃO SALARIAL – ${selectedEmp.name}`;
      const linha = ult
        ? `de ${formatCurrency(ult.old_salary)} para <b>${formatCurrency(
            ult.new_salary
          )}</b>`
        : `para <b>${formatCurrency(selectedEmp.salary)}</b>`;
      const linhaT = ult
        ? `de ${formatCurrency(ult.old_salary)} para ${formatCurrency(
            ult.new_salary
          )}`
        : `para ${formatCurrency(selectedEmp.salary)}`;

      const html = `
        <p>Prezados da ${config.contabilidade},</p>
        <p>Informamos o reajuste salarial do funcionário <b>${
          selectedEmp.name
        }</b>${
        selectedEmp.cpf ? `, inscrito no CPF nº ${selectedEmp.cpf}` : ""
      }, ocupante do cargo de <b>${selectedEmp.role || "—"}</b>, da empresa <b>${
        emp.razao
      }</b> (CNPJ nº ${emp.cnpj}).</p>
        <div class="blk"><span class="lab-blk">Novo salário em folha:</span> ${linha}${
        ult ? `<br>A partir de ${formatDate(ult.effective_date)}.` : ""
      }</div>
        <p>Solicitamos o ajuste em folha de pagamento conforme valores informados.</p>
        <p>Atenciosamente,<br>${config.signatario}</p>
      `;

      const text = `Prezados da ${config.contabilidade},

Informamos o reajuste salarial do funcionário ${selectedEmp.name}${
        selectedEmp.cpf ? `, inscrito no CPF nº ${selectedEmp.cpf}` : ""
      }, ocupante do cargo de ${selectedEmp.role || "—"}, da empresa ${cab}.

Novo salário em folha: ${linhaT}${
        ult ? ` (a partir de ${formatDate(ult.effective_date)})` : ""
      }.

Solicitamos o ajuste em folha de pagamento conforme valores informados.

Atenciosamente,
${config.signatario}`;

      return { assunto, html, text };
    }

    // Demissões e Pedidos
    const nome = selectedEmp.name;
    const cpf = selectedEmp.cpf || "—";
    const cargo = selectedEmp.role || "—";

    const dPedido = formatDate(selectedEmp.notice_start_date || selectedEmp.dismissal_date);
    const dIni = formatDate(selectedEmp.notice_start_date);
    const dFim = formatDate(selectedEmp.notice_end_date);
    const dUlt = formatDate(calcLastWorkDate(selectedEmp));

    let assunto = "";
    let corpoHtml = "";
    let corpoText = "";

    if (emailType === "pedido_com") {
      assunto = `PEDIDO DE DEMISSÃO – ${selectedEmp.name}`;
      corpoHtml = `<p>O funcionário <b>${nome}</b>, inscrito no CPF nº ${cpf}, ocupante do cargo de ${cargo}, solicitou pedido de demissão da empresa <b>${emp.razao}</b>, inscrita no CNPJ nº ${emp.cnpj}, na data de ${dPedido}.</p>
        <p>Informamos que o funcionário irá cumprir o aviso prévio trabalhado, com início em ${dIni} e término previsto para ${dFim}.</p>
        <p>Por favor, solicitamos o envio dos documentos rescisórios necessários para as devidas assinaturas e conferências.</p>
        <p>Solicitamos também que a rescisão seja feita considerando o salário mensal do funcionário e os dias trabalhados até a data final do aviso prévio, conforme rotina contábil e legislação aplicável.</p>`;
      corpoText = `O funcionário ${selectedEmp.name}, inscrito no CPF nº ${cpf}, ocupante do cargo de ${cargo}, solicitou pedido de demissão da empresa ${cab}, na data de ${dPedido}.

Informamos que o funcionário irá cumprir o aviso prévio trabalhado, com início em ${dIni} e término previsto para ${dFim}.

Por favor, solicitamos o envio dos documentos rescisórios necessários para as devidas assinaturas e conferências.

Solicitamos também que a rescisão seja feita considerando o salário mensal do funcionário e os dias trabalhados até a data final do aviso prévio, conforme rotina contábil e legislação aplicável.`;
    } else if (emailType === "pedido_sem") {
      assunto = `PEDIDO DE DEMISSÃO – ${selectedEmp.name}`;
      corpoHtml = `<p>O funcionário <b>${nome}</b>, inscrito no CPF nº ${cpf}, ocupante do cargo de ${cargo}, solicitou pedido de demissão da empresa <b>${emp.razao}</b>, inscrita no CNPJ nº ${emp.cnpj}, na data de ${dPedido}.</p>
        <p>Informamos que o funcionário não irá cumprir o aviso prévio, encerrando suas atividades na empresa em ${dUlt}.</p>
        <p>Por favor, solicitamos o envio dos documentos rescisórios necessários para as devidas assinaturas e conferências.</p>
        <p>Solicitamos também que a rescisão seja feita considerando o valor proporcional ao salário mensal do funcionário, referente aos dias trabalhados, observando os devidos descontos e orientações contábeis aplicáveis ao aviso prévio não trabalhado.</p>`;
      corpoText = `O funcionário ${selectedEmp.name}, inscrito no CPF nº ${cpf}, ocupante do cargo de ${cargo}, solicitou pedido de demissão da empresa ${cab}, na data de ${dPedido}.

Informamos que o funcionário não irá cumprir o aviso prévio, encerrando suas atividades na empresa em ${dUlt}.

Por favor, solicitamos o envio dos documentos rescisórios necessários para as devidas assinaturas e conferências.

Solicitamos também que a rescisão seja feita considerando o valor proporcional ao salário mensal do funcionário, referente aos dias trabalhados, observando os devidos descontos e orientações contábeis aplicáveis ao aviso prévio não trabalhado.`;
    } else if (emailType === "empresa_sem") {
      assunto = `DEMISSÃO – ${selectedEmp.name}`;
      corpoHtml = `<p>Informamos que a empresa <b>${emp.razao}</b>, inscrita no CNPJ nº ${emp.cnpj}, decidiu realizar a dispensa sem justa causa do funcionário <b>${nome}</b>, inscrito no CPF nº ${cpf}, ocupante do cargo de ${cargo}, na data de ${dUlt}.</p>
        <p>A demissão será feita sem cumprimento de aviso prévio trabalhado, sendo o aviso prévio indenizado pela empresa, conforme orientação contábil e legislação aplicável.</p>
        <p>Por favor, solicitamos o envio dos documentos rescisórios necessários para as devidas assinaturas e conferências.</p>
        <p>Solicitamos também que a rescisão seja feita considerando o salário mensal do funcionário, os dias trabalhados até ${dUlt}, bem como as verbas rescisórias devidas.</p>`;
      corpoText = `Informamos que a empresa ${cab}, decidiu realizar a dispensa sem justa causa do funcionário ${selectedEmp.name}, inscrito no CPF nº ${cpf}, ocupante do cargo de ${cargo}, na data de ${dUlt}.

A demissão será feita sem cumprimento de aviso prévio trabalhado, sendo o aviso prévio indenizado pela empresa, conforme orientação contábil e legislação aplicável.

Por favor, solicitamos o envio dos documentos rescisórios necessários para as devidas assinaturas e conferências.

Solicitamos também que a rescisão seja feita considerando o salário mensal do funcionário, os dias trabalhados até ${dUlt}, bem como as verbas rescisórias devidas.`;
    } else {
      // empresa_com
      assunto = `DEMISSÃO – ${selectedEmp.name}`;
      corpoHtml = `<p>Informamos que a empresa <b>${emp.razao}</b>, inscrita no CNPJ nº ${emp.cnpj}, decidiu realizar a dispensa sem justa causa do funcionário <b>${nome}</b>, inscrito no CPF nº ${cpf}, ocupante do cargo de ${cargo}, na data de ${dPedido}.</p>
        <p>Neste caso, solicitamos que o aviso prévio seja trabalhado pelo funcionário, com início em ${dIni} e término previsto para ${dFim}.</p>
        <p>Por favor, solicitamos o envio dos documentos necessários para comunicação, assinatura e posterior rescisão do funcionário.</p>
        <p>Solicitamos também que a rescisão seja feita considerando o salário mensal do funcionário, os dias trabalhados até o encerramento do aviso prévio e as demais verbas rescisórias devidas, conforme orientação contábil e legislação aplicável.</p>`;
      corpoText = `Informamos que a empresa ${cab}, decidiu realizar a dispensa sem justa causa do funcionário ${selectedEmp.name}, inscrito no CPF nº ${cpf}, ocupante do cargo de ${cargo}, na data de ${dPedido}.

Neste caso, solicitamos que o aviso prévio seja trabalhado pelo funcionário, com início em ${dIni} e término previsto para ${dFim}.

Por favor, solicitamos o envio dos documentos necessários para comunicação, assinatura e posterior rescisão do funcionário.

Solicitamos também que a rescisão seja feita considerando o salário mensal do funcionário, os dias trabalhados até o encerramento do aviso prévio e as demais verbas rescisórias devidas, conforme orientação contábil e legislação aplicável.`;
    }

    const html = `
      <p>Meus caros da ${config.contabilidade},</p>
      ${corpoHtml}
      <div class="blk"><span class="lab-blk">Relatório de presença/faltas:</span><br>${faltasText}</div>
      ${obsHtml}
      <p>Segue em anexo a carta de demissão do funcionário.</p>
      <p>Atenciosamente,<br>${config.signatario}</p>
    `;

    const text = `Meus caros da ${config.contabilidade},

${corpoText}

Relatório de presença/faltas: ${faltasText}${obs}

Segue em anexo a carta de demissão do funcionário.

Atenciosamente,
${config.signatario}`;

    return { assunto, html, text };
  }, [selectedEmp, emailType, emailObs, monthStr, config, salaryHistory]);

  // Copiar com formatação rica (Gmail/Outlook)
  const handleCopyFormatted = async () => {
    const node = document.getElementById("emailPrev");
    if (!node || !emailContent) return;
    try {
      const htmlBlob = new Blob([node.innerHTML], { type: "text/html" });
      const textBlob = new Blob([emailContent.text], { type: "text/plain" });
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": htmlBlob,
          "text/plain": textBlob,
        }),
      ]);
      setCopySuccess("formatted");
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (e) {
      console.error(e);
      alert("Não foi possível copiar com formatação automática. Selecione e copie manualmente.");
    }
  };

  // Copiar texto puro
  const handleCopyPlain = async () => {
    if (!emailContent) return;
    try {
      await navigator.clipboard.writeText(emailContent.text);
      setCopySuccess("plain");
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  // Imprimir / Salvar PDF
  const handlePrint = () => {
    const node = document.getElementById("emailPrev");
    if (!node || !emailContent) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html>
        <head>
          <title>${emailContent.assunto}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; color: #111; line-height: 1.6; }
            .blk { background: #fff8c4; padding: 10px 12px; border: 1px solid #f0e08a; border-radius: 5px; margin: 10px 0; }
            .lab-blk { font-weight: bold; background: #fff3a3; padding: 2px 6px; border-radius: 3px; }
          </style>
        </head>
        <body>
          <h3>Assunto: ${emailContent.assunto}</h3>
          <hr style="border: 0; border-top: 1px solid #ddd; margin: 15px 0;" />
          ${node.innerHTML}
        </body>
      </html>
    `);
    w.document.close();
    w.print();
  };

  return (
    <div className="space-y-6">
      {/* Estilos locais para simular o HTML de email */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .email-prev-wrapper { background: #ffffff; color: #1a1a1a; border-radius: 8px; padding: 22px; font-family: Arial, sans-serif; font-size: 13.5px; line-height: 1.6; max-height: 480px; overflow-y: auto; }
          .email-prev-wrapper .hl { background: #fff3a3; font-weight: bold; padding: 1px 3px; }
          .email-prev-wrapper .blk { background: #fff8c4; padding: 10px 12px; border-radius: 5px; margin: 10px 0; border: 1px solid #f0e08a; color: #1a1a1a; }
          .email-prev-wrapper .blk b { display: inline; }
          .email-prev-wrapper .lab-blk { font-weight: bold; background: #fff3a3; padding: 2px 6px; border-radius: 3px; color: #1a1a1a; }
        `
      }} />

      {/* Cabeçalho */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gerador de E-mails</h1>
          <p className="text-muted-foreground text-sm">
            Geração automática de e-mails para contabilidade ({config.contabilidade})
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setIsConfigOpen(!isConfigOpen)}
          className="border-slate-800 text-slate-300 hover:bg-slate-900"
        >
          <Settings className="h-4 w-4 mr-2" />
          Configurações de Assinatura
        </Button>
      </div>

      {/* Configurações Card */}
      {isConfigOpen && (
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-500">
              <Settings2 className="h-4 w-4" />
              Configurar Padrões do E-mail
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Nome da Contabilidade</Label>
              <Input
                value={config.contabilidade}
                onChange={(e) => saveConfig("contabilidade", e.target.value)}
                className="border-slate-200 dark:border-slate-800 bg-transparent"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Assinatura / Responsável</Label>
              <Select
                value={config.signatario}
                onValueChange={(v) => saveConfig("signatario", v || "")}
              >
                <SelectTrigger className="border-slate-200 dark:border-slate-800 bg-transparent flex justify-between items-center text-left">
                  <span>
                    {config.signatario === "Felipe Moura | Coordenador de Compras e Administrativo" && "Felipe Moura"}
                    {config.signatario === "Iana Raissa | Analista de RH e Financeiro" && "Iana Raissa"}
                    {config.signatario !== "Felipe Moura | Coordenador de Compras e Administrativo" && 
                     config.signatario !== "Iana Raissa | Analista de RH e Financeiro" && 
                     (config.signatario || "Selecione a assinatura")}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Felipe Moura | Coordenador de Compras e Administrativo">
                    Felipe Moura | Coordenador de Compras e Administrativo
                  </SelectItem>
                  <SelectItem value="Iana Raissa | Analista de RH e Financeiro">
                    Iana Raissa | Analista de RH e Financeiro
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Carga Horária Padrão</Label>
              <Input
                value={config.cargaHoraria}
                onChange={(e) => saveConfig("cargaHoraria", e.target.value)}
                className="border-slate-200 dark:border-slate-800 bg-transparent"
              />
            </div>
            <div className="space-y-1 md:col-span-3">
              <Label className="text-xs">Horário de Trabalho - Seg a Qui</Label>
              <Input
                value={config.horario1}
                onChange={(e) => saveConfig("horario1", e.target.value)}
                className="border-slate-200 dark:border-slate-800 bg-transparent"
              />
            </div>
            <div className="space-y-1 md:col-span-3">
              <Label className="text-xs">Horário de Trabalho - Carga Sexta</Label>
              <Input
                value={config.horario2}
                onChange={(e) => saveConfig("horario2", e.target.value)}
                className="border-slate-200 dark:border-slate-800 bg-transparent"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Seletores */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40">
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Funcionário</Label>
            <Select key={activeEmployees.length} value={selectedEmpId} onValueChange={(v) => setSelectedEmpId(v || "")}>
              <SelectTrigger className="w-full border-slate-200 dark:border-slate-800 bg-transparent flex justify-between items-center text-slate-800 dark:text-slate-200">
                <span>
                  {selectedEmp ? `${selectedEmp.name} ${selectedEmp.pagador ? `(${selectedEmp.pagador})` : ""}` : "Selecione o funcionário"}
                </span>
              </SelectTrigger>
              <SelectContent>
                {activeEmployees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} {e.pagador ? `(${e.pagador})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs text-muted-foreground">Tipo de E-mail</Label>
            <Select value={emailType} onValueChange={(v) => setEmailType(v || "admissao")}>
              <SelectTrigger className="w-full border-slate-200 dark:border-slate-800 bg-transparent flex justify-between items-center text-slate-800 dark:text-slate-200">
                <span>
                  {EMAIL_TYPES.find((t) => t.k === emailType)?.t || "Selecione o tipo"}
                </span>
              </SelectTrigger>
              <SelectContent>
                {EMAIL_TYPES.map((t) => (
                  <SelectItem key={t.k} value={t.k}>
                    {t.t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {emailType !== "admissao" && emailType !== "aumento" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Competência / Mês Vigente</Label>
                <Input
                  type="month"
                  value={monthStr}
                  onChange={(e) => setMonthStr(e.target.value)}
                  className="border-slate-200 dark:border-slate-800 bg-transparent text-slate-850 dark:text-slate-250"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs text-muted-foreground">
                  Observações / Valores Manuais (Descontos, vales ou quinzenas pagas)
                </Label>
                <textarea
                  value={emailObs}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEmailObs(e.target.value)}
                  placeholder="Ex: 1ª quinzena de R$ 1.000,00 já paga; deduzir vale de R$ 150,00."
                  className="flex min-h-[60px] w-full rounded-md border border-slate-200 dark:border-slate-800 bg-transparent px-3 py-2 text-sm text-slate-800 dark:text-slate-350 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Pré-visualização */}
      {selectedEmp ? (
        emailContent && (
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-200 dark:border-slate-800 py-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-500" />
                <span>
                  Pré-visualização — assunto:{" "}
                  <span className="text-muted-foreground font-mono ml-1 font-normal text-xs">
                    {emailContent.assunto}
                  </span>
                </span>
              </CardTitle>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleCopyFormatted}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                >
                  {copySuccess === "formatted" ? (
                    <Check className="h-3.5 w-3.5 text-emerald-300" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copySuccess === "formatted" ? "Copiado!" : "Copiar com Formatação"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyPlain}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800 gap-1.5"
                >
                  {copySuccess === "plain" ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copySuccess === "plain" ? "Copiado!" : "Copiar Texto"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePrint}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800 gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" />
                  PDF / Imprimir
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div
                id="emailPrev"
                className="email-prev-wrapper shadow-inner"
                dangerouslySetInnerHTML={{ __html: emailContent.html }}
              />
              <p className="text-xs text-muted-foreground mt-4">
                💡 Os blocos em amarelo (dados do funcionário / admissão / faltas) saem destacados
                automaticamente ao clicar em <b>Copiar com Formatação</b> e colar no Gmail.
              </p>
            </CardContent>
          </Card>
        )
      ) : (
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Mail className="h-8 w-8 mb-2 opacity-40" />
            <p>Cadastre um funcionário para gerar e-mails.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
