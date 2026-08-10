import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// =====================================================
// CONFIGURAZIONE
// =====================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// JSON dei giocatori
const JSON_PATH = path.join(__dirname, "src", "giocatori.json");

// Cartella immagini
const OUTPUT_DIR = path.join(__dirname, "public", "images", "players");

// URL campioncini Fantacalcio
const IMAGE_URL = (playerId) =>
  `https://content.fantacalcio.it/web/campioncini/21/card/${playerId}.png?v=644`;

// Pausa tra le richieste
const DELAY_MS = 200;

// =====================================================
// FUNZIONE PAUSA
// =====================================================

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// =====================================================
// DOWNLOAD IMMAGINE
// =====================================================

async function downloadImage(player) {
  const fileName = `${player.id}.png`;

  const outputPath = path.join(OUTPUT_DIR, fileName);

  // Se esiste già, non scaricarla nuovamente
  if (fs.existsSync(outputPath)) {
    return {
      status: "skipped",
      player,
    };
  }

  const url = IMAGE_URL(player.id);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "image/png,image/*,*/*",
      },
    });

    // Controllo risposta HTTP
    if (!response.ok) {
      return {
        status: "failed",
        player,
        reason: `HTTP ${response.status}`,
      };
    }

    // Controllo che sia un'immagine
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("image")) {
      return {
        status: "failed",
        player,
        reason: `Content-Type non valido: ${contentType}`,
      };
    }

    // Convertiamo la risposta in Buffer
    const buffer = Buffer.from(await response.arrayBuffer());

    // Salviamo il file
    fs.writeFileSync(outputPath, buffer);

    return {
      status: "downloaded",
      player,
    };
  } catch (error) {
    return {
      status: "failed",
      player,
      reason: error.message,
    };
  }
}

// =====================================================
// PROGRAMMA PRINCIPALE
// =====================================================

async function main() {
  console.log("");
  console.log("==========================================");
  console.log("       CAMPIONCINI FANTACALCIO");
  console.log("==========================================");
  console.log("");

  // ===================================================
  // CONTROLLO JSON
  // ===================================================

  if (!fs.existsSync(JSON_PATH)) {
    console.error("❌ ERRORE: giocatori.json non trovato.");

    console.error("");

    console.error("Percorso cercato:");

    console.error(JSON_PATH);

    process.exit(1);
  }

  // ===================================================
  // LETTURA JSON
  // ===================================================

  let data;

  try {
    const json = fs.readFileSync(JSON_PATH, "utf8");

    data = JSON.parse(json);
  } catch (error) {
    console.error("❌ ERRORE nella lettura del JSON:");

    console.error(error.message);

    process.exit(1);
  }

  // ===================================================
  // CONTROLLO PLAYERS
  // ===================================================

  if (!Array.isArray(data.players)) {
    console.error('❌ ERRORE: nel JSON non esiste "players".');

    process.exit(1);
  }

  // ===================================================
  // PRENDIAMO TUTTI I GIOCATORI
  // ===================================================

  const players = data.players.filter(
    (player) =>
      player && player.id !== undefined && player.id !== null && player.name,
  );

  // ===================================================
  // CREA CARTELLA IMMAGINI
  // ===================================================

  fs.mkdirSync(OUTPUT_DIR, {
    recursive: true,
  });

  console.log(`👤 Giocatori trovati: ${players.length}`);

  console.log("");

  console.log(`📁 Destinazione: ${OUTPUT_DIR}`);

  console.log("");

  console.log("🚀 Inizio download...");

  console.log("");

  // ===================================================
  // CONTATORI
  // ===================================================

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  const errors = [];

  // ===================================================
  // DOWNLOAD DI TUTTI I GIOCATORI
  // ===================================================

  for (let i = 0; i < players.length; i++) {
    const player = players[i];

    process.stdout.write(
      `[${String(i + 1).padStart(3, "0")}/${players.length}] ` +
        `${player.name} - ${player.team} ... `,
    );

    const result = await downloadImage(player);

    // -------------------------------------------------
    // SCARICATO
    // -------------------------------------------------

    if (result.status === "downloaded") {
      downloaded++;

      console.log("✅");
    }

    // -------------------------------------------------
    // GIÀ PRESENTE
    // -------------------------------------------------
    else if (result.status === "skipped") {
      skipped++;

      console.log("⏭️ già presente");
    }

    // -------------------------------------------------
    // ERRORE
    // -------------------------------------------------
    else {
      failed++;

      console.log(`❌ ${result.reason}`);

      errors.push({
        id: player.id,

        name: player.name,

        team: player.team,

        reason: result.reason,

        url: IMAGE_URL(player.id),
      });
    }

    // Piccola pausa tra le richieste
    await sleep(DELAY_MS);
  }

  // ===================================================
  // REPORT ERRORI
  // ===================================================

  if (errors.length > 0) {
    const errorFile = path.join(OUTPUT_DIR, "download-errors.json");

    fs.writeFileSync(
      errorFile,

      JSON.stringify(errors, null, 2),

      "utf8",
    );

    console.log("");

    console.log(`⚠️ Report errori creato:`);

    console.log(errorFile);
  }

  // ===================================================
  // RISULTATO FINALE
  // ===================================================

  console.log("");

  console.log("==========================================");

  console.log("              RISULTATO");

  console.log("==========================================");

  console.log(`👥 Totale giocatori: ${players.length}`);

  console.log(`✅ Scaricati:        ${downloaded}`);

  console.log(`⏭️ Già presenti:     ${skipped}`);

  console.log(`❌ Errori:            ${failed}`);

  console.log("==========================================");

  console.log("");

  console.log("🏁 Download terminato!");

  console.log("");

  console.log(`📁 Immagini: ${OUTPUT_DIR}`);

  console.log("");
}

// =====================================================
// AVVIO
// =====================================================

main();
