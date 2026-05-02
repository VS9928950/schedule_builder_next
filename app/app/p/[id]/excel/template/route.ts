import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSessionUser } from "@/lib/session";
import { getProject } from "@/lib/store";

/** Универсальный шаблон листа «Перечень» (лишние колонки при импорте игнорируются). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) return NextResponse.json({ error: "bad_project" }, { status: 400 });

  const project = getProject(projectId, user.id);
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const headers = [
    "Дата",
    "Начало",
    "Окончание",
    "Наименование",
    "Описание",
    "Корпус",
    "Аудитория",
    "Формат",
    "№",
    "Ссылка"
  ];
  const example = [
    "Введите дату Excel или серийный номер даты",
    "Дробная часть суток для начала (как в Excel)",
    "Дробная часть суток для конца",
    "Название мероприятия",
    "",
    "",
    "",
    "",
    "",
    "https://"
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Перечень");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });

  const safeName = encodeURIComponent(`perechen-template-${project.id}.xlsx`);
  return new NextResponse(blob, {
    status: 200,
    headers: {
      "Content-Disposition": `attachment; filename*=UTF-8''${safeName}`
    }
  });
}
