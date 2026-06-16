import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LU_BZR_SOURCES = [
  { gemeinde: "Adligenswil", bfsNr: 1051, url: "https://geoshop.lu.ch/pdf/adli_BZR.pdf" },
  { gemeinde: "Aesch (LU)", bfsNr: 1021, url: "https://geoshop.lu.ch/pdf/aesc_BZR.pdf" },
  { gemeinde: "Alberswil", bfsNr: 1121, url: "https://geoshop.lu.ch/pdf/albe_BZR.pdf" },
  { gemeinde: "Altbüron", bfsNr: 1122, url: "https://geoshop.lu.ch/pdf/altb_BZR.pdf" },
  { gemeinde: "Altishofen", bfsNr: 1123, url: "https://geoshop.lu.ch/pdf/alti_BZR.pdf" },
  { gemeinde: "Ballwil", bfsNr: 1023, url: "https://geoshop.lu.ch/pdf/ball_BZR.pdf" },
  { gemeinde: "Beromünster", bfsNr: 1081, url: "https://geoshop.lu.ch/pdf/bero_BZR.pdf" },
  { gemeinde: "Buchrain", bfsNr: 1052, url: "https://geoshop.lu.ch/pdf/buch_BZR.pdf" },
  { gemeinde: "Buttisholz", bfsNr: 1083, url: "https://geoshop.lu.ch/pdf/butt_BZR.pdf" },
  { gemeinde: "Büron", bfsNr: 1082, url: "https://geoshop.lu.ch/pdf/buro_BZR.pdf" },
  { gemeinde: "Dagmersellen", bfsNr: 1125, url: "https://geoshop.lu.ch/pdf/dagm_BZR.pdf" },
  { gemeinde: "Dierikon", bfsNr: 1053, url: "https://geoshop.lu.ch/pdf/dier_BZR.pdf" },
  { gemeinde: "Doppleschwand", bfsNr: 1001, url: "https://geoshop.lu.ch/pdf/dopp_BZR.pdf" },
  { gemeinde: "Ebikon", bfsNr: 1054, url: "https://geoshop.lu.ch/pdf/ebik_BZR.pdf" },
  { gemeinde: "Egolzwil", bfsNr: 1127, url: "https://geoshop.lu.ch/pdf/egol_BZR.pdf" },
  { gemeinde: "Eich", bfsNr: 1084, url: "https://geoshop.lu.ch/pdf/eich_BZR.pdf" },
  { gemeinde: "Emmen", bfsNr: 1024, url: "https://geoshop.lu.ch/pdf/emme_BZR.pdf" },
  { gemeinde: "Entlebuch", bfsNr: 1002, url: "https://geoshop.lu.ch/pdf/entl_BZR.pdf" },
  { gemeinde: "Ermensee", bfsNr: 1025, url: "https://geoshop.lu.ch/pdf/erme_BZR.pdf" },
  { gemeinde: "Ettiswil", bfsNr: 1128, url: "https://geoshop.lu.ch/pdf/etti_BZR.pdf" },
  { gemeinde: "Fischbach", bfsNr: 1129, url: "https://geoshop.lu.ch/pdf/fisc_BZR.pdf" },
  { gemeinde: "Flühli", bfsNr: 1004, url: "https://geoshop.lu.ch/pdf/fluh_BZR.pdf" },
  { gemeinde: "Geuensee", bfsNr: 1085, url: "https://geoshop.lu.ch/pdf/geue_BZR.pdf" },
  { gemeinde: "Gisikon", bfsNr: 1055, url: "https://geoshop.lu.ch/pdf/gisi_BZR.pdf" },
  { gemeinde: "Greppen", bfsNr: 1056, url: "https://geoshop.lu.ch/pdf/grep_BZR.pdf" },
  { gemeinde: "Hasle (LU)", bfsNr: 1005, url: "https://geoshop.lu.ch/pdf/hasl_BZR.pdf" },
  { gemeinde: "Hergiswil bei Willisau", bfsNr: 1132, url: "https://geoshop.lu.ch/pdf/herg_BZR.pdf" },
  { gemeinde: "Hildisrieden", bfsNr: 1088, url: "https://geoshop.lu.ch/pdf/hild_BZR.pdf" },
  { gemeinde: "Hitzkirch", bfsNr: 1030, url: "https://geoshop.lu.ch/pdf/hitz_BZR.pdf" },
  { gemeinde: "Hochdorf", bfsNr: 1031, url: "https://geoshop.lu.ch/pdf/hoch_BZR.pdf" },
  { gemeinde: "Hohenrain", bfsNr: 1032, url: "https://geoshop.lu.ch/pdf/hohe_BZR.pdf" },
  { gemeinde: "Horw", bfsNr: 1058, url: "https://geoshop.lu.ch/pdf/horw_BZR.pdf" },
  { gemeinde: "Inwil", bfsNr: 1033, url: "https://geoshop.lu.ch/pdf/inwi_BZR.pdf" },
  { gemeinde: "Knutwil", bfsNr: 1089, url: "https://geoshop.lu.ch/pdf/knut_BZR.pdf" },
  { gemeinde: "Kriens", bfsNr: 1059, url: "https://geoshop.lu.ch/pdf/krie_BZR.pdf" },
  { gemeinde: "Luthern", bfsNr: 1135, url: "https://geoshop.lu.ch/pdf/luth_BZR.pdf" },
  { gemeinde: "Luzern", bfsNr: 1061, url: "https://geoshop.lu.ch/pdf/luze_BZR.pdf" },
  { gemeinde: "Malters", bfsNr: 1062, url: "https://geoshop.lu.ch/pdf/malt_BZR.pdf" },
  { gemeinde: "Mauensee", bfsNr: 1091, url: "https://geoshop.lu.ch/pdf/maue_BZR.pdf" },
  { gemeinde: "Meggen", bfsNr: 1063, url: "https://geoshop.lu.ch/pdf/megg_BZR.pdf" },
  { gemeinde: "Meierskappel", bfsNr: 1064, url: "https://geoshop.lu.ch/pdf/meie_BZR.pdf" },
  { gemeinde: "Menznau", bfsNr: 1136, url: "https://geoshop.lu.ch/pdf/menz_BZR.pdf" },
  { gemeinde: "Nebikon", bfsNr: 1137, url: "https://geoshop.lu.ch/pdf/nebi_BZR.pdf" },
  { gemeinde: "Neuenkirch", bfsNr: 1093, url: "https://geoshop.lu.ch/pdf/neue_BZR.pdf" },
  { gemeinde: "Nottwil", bfsNr: 1094, url: "https://geoshop.lu.ch/pdf/nott_BZR.pdf" },
  { gemeinde: "Oberkirch", bfsNr: 1095, url: "https://geoshop.lu.ch/pdf/ober_BZR.pdf" },
  { gemeinde: "Pfaffnau", bfsNr: 1139, url: "https://geoshop.lu.ch/pdf/pfaf_BZR.pdf" },
  { gemeinde: "Rain", bfsNr: 1037, url: "https://geoshop.lu.ch/pdf/rain_BZR.pdf" },
  { gemeinde: "Reiden", bfsNr: 1140, url: "https://geoshop.lu.ch/pdf/reid_BZR.pdf" },
  { gemeinde: "Rickenbach (LU)", bfsNr: 1097, url: "https://geoshop.lu.ch/pdf/rick_BZR.pdf" },
  { gemeinde: "Roggliswil", bfsNr: 1142, url: "https://geoshop.lu.ch/pdf/rogg_BZR.pdf" },
  { gemeinde: "Romoos", bfsNr: 1007, url: "https://geoshop.lu.ch/pdf/romo_BZR.pdf" },
  { gemeinde: "Root", bfsNr: 1065, url: "https://geoshop.lu.ch/pdf/root_BZR.pdf" },
  { gemeinde: "Rothenburg", bfsNr: 1040, url: "https://geoshop.lu.ch/pdf/roth_BZR.pdf" },
  { gemeinde: "Ruswil", bfsNr: 1098, url: "https://geoshop.lu.ch/pdf/rusw_BZR.pdf" },
  { gemeinde: "Römerswil", bfsNr: 1039, url: "https://geoshop.lu.ch/pdf/rome_BZR.pdf" },
  { gemeinde: "Schenkon", bfsNr: 1099, url: "https://geoshop.lu.ch/pdf/sche_BZR.pdf" },
  { gemeinde: "Schlierbach", bfsNr: 1100, url: "https://geoshop.lu.ch/pdf/schl_BZR.pdf" },
  { gemeinde: "Schwarzenberg", bfsNr: 1066, url: "https://geoshop.lu.ch/pdf/schw_BZR.pdf" },
  { gemeinde: "Schüpfheim", bfsNr: 1008, url: "https://geoshop.lu.ch/pdf/schu_BZR.pdf" },
  { gemeinde: "Sempach", bfsNr: 1102, url: "https://geoshop.lu.ch/pdf/semp_BZR.pdf" },
  { gemeinde: "Sursee", bfsNr: 1103, url: "https://geoshop.lu.ch/pdf/surs_BZR.pdf" },
  { gemeinde: "Triengen", bfsNr: 1104, url: "https://geoshop.lu.ch/pdf/trie_BZR.pdf" },
  { gemeinde: "Udligenswil", bfsNr: 1067, url: "https://geoshop.lu.ch/pdf/udli_BZR.pdf" },
  { gemeinde: "Ufhusen", bfsNr: 1145, url: "https://geoshop.lu.ch/pdf/ufhu_BZR.pdf" },
  { gemeinde: "Vitznau", bfsNr: 1068, url: "https://geoshop.lu.ch/pdf/vitz_BZR.pdf" },
  { gemeinde: "Wauwil", bfsNr: 1146, url: "https://geoshop.lu.ch/pdf/wauw_BZR.pdf" },
  { gemeinde: "Weggis", bfsNr: 1069, url: "https://geoshop.lu.ch/pdf/wegg_BZR.pdf" },
  { gemeinde: "Werthenstein", bfsNr: 1009, url: "https://geoshop.lu.ch/pdf/wert_BZR.pdf" },
  { gemeinde: "Wikon", bfsNr: 1147, url: "https://geoshop.lu.ch/pdf/wiko_BZR.pdf" },
  { gemeinde: "Willisau", bfsNr: 1151, url: "https://geoshop.lu.ch/pdf/will_BZR.pdf" },
  { gemeinde: "Wolhusen", bfsNr: 1107, url: "https://geoshop.lu.ch/pdf/wolh_BZR.pdf" },
  { gemeinde: "Zell (LU)", bfsNr: 1150, url: "https://geoshop.lu.ch/pdf/zell_BZR.pdf" },
];

type ImportStatus =
  | "inserted"
  | "already_exists"
  | "no_municipality"
  | "not_a_pdf"
  | "upload_failed"
  | "insert_failed"
  | "fetch_failed"
  | `http_${number}`;

type ImportResult = { gemeinde: string; status: ImportStatus | string; error?: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const importLuBzrDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: adminRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRow) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Get LU canton id
    const { data: canton, error: cantonErr } = await supabaseAdmin
      .from("cantons")
      .select("id")
      .eq("code", "LU")
      .maybeSingle();
    if (cantonErr || !canton) throw new Error("Kanton LU nicht gefunden");

    const results: ImportResult[] = [];

    for (const src of LU_BZR_SOURCES) {
      try {
        const { data: muni } = await supabaseAdmin
          .from("municipalities")
          .select("id")
          .eq("canton_id", canton.id)
          .eq("name", src.gemeinde)
          .maybeSingle();
        if (!muni) {
          results.push({ gemeinde: src.gemeinde, status: "no_municipality" });
          await sleep(300);
          continue;
        }

        const { data: existing } = await supabaseAdmin
          .from("regulation_documents")
          .select("id")
          .eq("municipality_id", muni.id)
          .eq("doc_type", "BZR")
          .eq("active", true)
          .maybeSingle();
        if (existing) {
          results.push({ gemeinde: src.gemeinde, status: "already_exists" });
          await sleep(300);
          continue;
        }

        let resp: Response;
        try {
          resp = await fetch(src.url);
        } catch (e) {
          results.push({
            gemeinde: src.gemeinde,
            status: "fetch_failed",
            error: e instanceof Error ? e.message : String(e),
          });
          await sleep(300);
          continue;
        }
        if (!resp.ok) {
          results.push({ gemeinde: src.gemeinde, status: `http_${resp.status}` });
          await sleep(300);
          continue;
        }

        const buf = Buffer.from(await resp.arrayBuffer());
        const head = buf.subarray(0, 5).toString("utf-8");
        if (buf.length < 2000 || head !== "%PDF-") {
          results.push({ gemeinde: src.gemeinde, status: "not_a_pdf" });
          await sleep(300);
          continue;
        }

        const filePath = `LU/${src.gemeinde}/BZR.pdf`;
        const { error: upErr } = await supabaseAdmin.storage
          .from("regulation-documents")
          .upload(filePath, buf, { contentType: "application/pdf", upsert: true });
        if (upErr) {
          results.push({ gemeinde: src.gemeinde, status: "upload_failed", error: upErr.message });
          await sleep(300);
          continue;
        }

        const { error: insErr } = await supabaseAdmin.from("regulation_documents").insert({
          municipality_id: muni.id,
          doc_type: "BZR",
          title: `Bau- und Zonenreglement ${src.gemeinde}`,
          file_path: filePath,
          file_name: "BZR.pdf",
          file_size: buf.length,
          mime_type: "application/pdf",
          notes: `Automatisch importiert von ${src.url} (BFS-Nr ${src.bfsNr})`,
          uploaded_by: userId,
        });
        if (insErr) {
          results.push({ gemeinde: src.gemeinde, status: "insert_failed", error: insErr.message });
          await sleep(300);
          continue;
        }

        results.push({ gemeinde: src.gemeinde, status: "inserted" });
      } catch (e) {
        results.push({
          gemeinde: src.gemeinde,
          status: "fetch_failed",
          error: e instanceof Error ? e.message : String(e),
        });
      }
      await sleep(300);
    }

    const summary: Record<string, number> = {};
    for (const r of results) summary[r.status] = (summary[r.status] ?? 0) + 1;
    return { results, summary };
  });
