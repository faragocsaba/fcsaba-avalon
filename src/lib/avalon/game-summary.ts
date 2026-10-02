import type { PlayerView } from "./engine";

export interface QuestSummary {
  number: number;
  result: "good" | "evil" | null;
  fails: number | null;
}

export interface GameSummary {
  winner: "good" | "evil";
  winnerLabel: string;
  reason: string;
  roomCode: string;
  playerCount: number;
  quests: QuestSummary[];
}

export function createGameSummary(view: PlayerView, roomCode: string): GameSummary | null {
  if (view.phase !== "over" || !view.winner) return null;
  return {
    winner: view.winner,
    winnerLabel: view.winner === "good" ? "A JÓK GYŐZTEK" : "A GONOSZ GYŐZÖTT",
    reason: view.reason ?? "A játszma véget ért.",
    roomCode: roomCode.toUpperCase(),
    playerCount: view.players.length,
    quests: Array.from({ length: 5 }, (_, index) => ({
      number: index + 1,
      result: view.results[index] ?? null,
      fails: view.questFails[index] ?? null,
    })),
  };
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function drawCenteredWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  lines.forEach((value, index) => ctx.fillText(value, centerX, startY + index * lineHeight));
}

export async function renderGameSummaryPng(summary: GameSummary): Promise<Blob> {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("A kép nem készíthető el ezen az eszközön.");

  const gold = "#d9ad55";
  const parchment = "#eee4c7";
  const muted = "#aaa38f";
  const surface = "#222532";
  const good = "#4f91bd";
  const evil = "#bd4e49";
  const winnerColor = summary.winner === "good" ? good : evil;

  const background = ctx.createLinearGradient(0, 0, 1080, 1350);
  background.addColorStop(0, "#12141c");
  background.addColorStop(0.55, "#1c1f2b");
  background.addColorStop(1, "#101219");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 1080, 1350);

  ctx.strokeStyle = gold;
  ctx.lineWidth = 3;
  ctx.strokeRect(44, 44, 992, 1262);
  ctx.strokeStyle = "rgba(217, 173, 85, 0.28)";
  ctx.lineWidth = 1;
  ctx.strokeRect(58, 58, 964, 1234);

  ctx.textAlign = "center";
  ctx.fillStyle = gold;
  ctx.font = '700 68px "Cinzel", Georgia, serif';
  ctx.fillText("AVALON", 540, 164);
  ctx.fillStyle = muted;
  ctx.font = '600 25px "Crimson Pro", Georgia, serif';
  ctx.fillText("A JÁTSZMA KRÓNIKÁJA", 540, 213);

  roundedRect(ctx, 116, 272, 848, 240, 12);
  ctx.fillStyle = surface;
  ctx.fill();
  ctx.strokeStyle = winnerColor;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = winnerColor;
  ctx.font = '700 48px "Cinzel", Georgia, serif';
  ctx.fillText(summary.winnerLabel, 540, 365);
  ctx.fillStyle = parchment;
  ctx.font = '400 32px "Crimson Pro", Georgia, serif';
  drawCenteredWrappedText(ctx, summary.reason, 540, 421, 730, 39);

  ctx.fillStyle = gold;
  ctx.font = '700 30px "Cinzel", Georgia, serif';
  ctx.fillText("A KÜLDETÉSEK", 540, 600);

  const startX = 140;
  const gap = 200;
  summary.quests.forEach((quest, index) => {
    const x = startX + index * gap;
    const color = quest.result === "good" ? good : quest.result === "evil" ? evil : "#555966";
    ctx.beginPath();
    ctx.arc(x, 720, 70, 0, Math.PI * 2);
    ctx.fillStyle = surface;
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = quest.result ? 7 : 3;
    ctx.stroke();

    ctx.fillStyle = parchment;
    ctx.font = '700 36px "Cinzel", Georgia, serif';
    ctx.fillText(String(quest.number), x, 733);
    ctx.fillStyle = color;
    ctx.font = '700 23px "Crimson Pro", Georgia, serif';
    ctx.fillText(quest.result === "good" ? "SIKER" : quest.result === "evil" ? "KUDARC" : "—", x, 833);
    ctx.fillStyle = muted;
    ctx.font = '400 21px "Crimson Pro", Georgia, serif';
    ctx.fillText(quest.fails === null ? "nem került sorra" : `${quest.fails} kudarclap`, x, 868);
  });

  ctx.strokeStyle = "rgba(217, 173, 85, 0.35)";
  ctx.beginPath();
  ctx.moveTo(116, 955);
  ctx.lineTo(964, 955);
  ctx.stroke();

  ctx.fillStyle = muted;
  ctx.font = '600 25px "Crimson Pro", Georgia, serif';
  ctx.fillText("SZOBÁKÓD", 315, 1034);
  ctx.fillText("JÁTÉKOSOK", 765, 1034);
  ctx.fillStyle = parchment;
  ctx.font = '700 44px "Cinzel", Georgia, serif';
  ctx.fillText(summary.roomCode, 315, 1094);
  ctx.fillText(String(summary.playerCount), 765, 1094);

  ctx.fillStyle = gold;
  ctx.font = '400 24px "Crimson Pro", Georgia, serif';
  ctx.fillText("Emlékezz a küldetésre. Ne bízz senkiben.", 540, 1225);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("A PNG létrehozása sikertelen."))), "image/png");
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}