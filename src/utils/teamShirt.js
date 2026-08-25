const SHIRT_MAP = {
  atalanta: "atalanta.png",
  bologna: "bologna.png",
  cagliari: "cagliari.png",
  como: "como.png",
  fiorentina: "fiorentina.png",
  frosinone: "frosinone.png",
  genoa: "genoa.png",
  inter: "inter.png",
  juventus: "juventus.png",
  lazio: "lazio.png",
  lecce: "lecce.png",
  milan: "milan.png",
  monza: "monza.png",
  napoli: "napoli.png",
  parma: "parma.png",
  roma: "roma.png",
  sassuolo: "sassuolo.png",
  torino: "torino.png",
  udinese: "udinese.png",
  venezia: "venezia.png",
};

export function normalizeTeamName(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function getTeamShirtUrl(team) {
  const key = normalizeTeamName(team);
  const file = SHIRT_MAP[key];
  return file ? `/images/shirts/${file}` : null;
}
