"use strict";

const { collectNews, writeNewsFile } = require("../lib/collect");

(async () => {
  const data = await collectNews();
  if (!data.total) {
    console.error("Collecte échouée : aucun article récupéré, source :\n", JSON.stringify(data.errored));
    process.exit(1);
  }
  const target = writeNewsFile(data);
  console.log(`Collecte OK : ${data.total} articles -> ${target}`);
  console.log("counts :", JSON.stringify(data.counts));
  if (data.errored.length) console.log("flux indisponibles :", JSON.stringify(data.errored));
})().catch((error) => {
  console.error("Collecte échouée :", error.message);
  process.exit(1);
});
