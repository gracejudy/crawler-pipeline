/**
 * Qoo10 overwrite-only deterministic probe (v2 precondition)
 *
 * Goal:
 * - Use proven update path (ItemsBasic.UpdateGoods)
 * - Update SAME ItemCode twice with different run markers
 * - Read-back via ItemsLookup.GetItemDetailInfo
 * - Ensure no accumulation signal (item counts unchanged)
 */
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { qoo10PostMethod } from "../src/qoo10Client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "..", ".env") });

const REQUIRED_ENV = ["QOO10_SAK", "QOO10_WRITE_APPROVED"];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[STOP] Missing env: ${key}`);
    process.exit(1);
  }
}
if (process.env.QOO10_WRITE_APPROVED !== "1") {
  console.error("[STOP] Write probe requires explicit approval: QOO10_WRITE_APPROVED=1");
  process.exit(1);
}

const STATUSES = ["S0", "S1", "S2", "S3", "S5", "S8"];

async function getStatusTotals() {
  const totals = {};
  for (const s of STATUSES) {
    const r = await qoo10PostMethod("ItemsLookup.GetAllGoodsInfo", {
      returnType: "application/json",
      ItemStatus: s,
    });
    if (r.data?.ResultCode !== 0) {
      throw new Error(`GetAllGoodsInfo failed for ${s}: ${r.data?.ResultMsg}`);
    }
    totals[s] = Number(r.data?.ResultObject?.TotalItems || 0);
  }
  return totals;
}

async function pickTargetItemCode() {
  const manual = process.env.QOO10_UPDATE_TARGET_ITEM_CODE?.trim();
  if (manual) return { itemCode: manual, source: "env" };

  for (const status of ["S1", "S2"]) {
    const r = await qoo10PostMethod("ItemsLookup.GetAllGoodsInfo", {
      returnType: "application/json",
      ItemStatus: status,
    });
    const first = r.data?.ResultObject?.Items?.[0];
    if (first?.ItemCode) {
      return { itemCode: first.ItemCode, source: `auto:${status}` };
    }
  }
  throw new Error("No existing target entity found in S1/S2.");
}

async function readDetail(itemCode) {
  const r = await qoo10PostMethod("ItemsLookup.GetItemDetailInfo", {
    returnType: "application/json",
    ItemCode: itemCode,
  });
  if (r.data?.ResultCode !== 0) {
    throw new Error(`GetItemDetailInfo failed: ${r.data?.ResultMsg}`);
  }
  const d = r.data?.ResultObject?.[0];
  if (!d) throw new Error("GetItemDetailInfo returned empty ResultObject");
  return d;
}

function normalizePrice(v, fallback = 1000) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? String(n) : String(fallback);
}

function buildUpdatePayload(detail, itemCode, markerTitle) {
  return {
    returnType: "application/json",
    ItemCode: String(itemCode),
    SecondSubCat: String(detail.SecondSubCatCd || ""),
    ItemTitle: String(markerTitle),
    ItemPrice: normalizePrice(detail.SellPrice),
    ItemQty: String(detail.ItemQty || "1"),
    AvailableDateType: "0",
    AvailableDateValue: "2",
    ShippingNo: String(detail.ShippingNo || "0"),
    StandardImage: String(detail.ImageUrl || "https://dp.image-qoo10.jp/GMKT.IMG/loading_2017/qoo10_loading.v_20170420.png"),
    ItemDescription: String(detail.ItemDetail || "<p>update probe</p>"),
    TaxRate: "S",
    ExpireDate: String(detail.ExpireDate || "2030-12-31"),
    AdultYN: String(detail.AdultYN || "N"),
    RetailPrice: normalizePrice(detail.RetailPrice, 0),
    ProductionPlaceType: "2",
    ProductionPlace: "Overseas",
    Weight: "1",
  };
}

function marker(base, seq) {
  return `[OVW-${base}-${seq}]`;
}

function applyMarkerTitle(originalTitle, mark) {
  const max = 95; // conservative for title length safety
  const suffix = ` ${mark}`;
  const keep = Math.max(1, max - suffix.length);
  return `${String(originalTitle).slice(0, keep)}${suffix}`;
}

async function updateOnce(itemCode, payload, expectedMarker, seq) {
  const u = await qoo10PostMethod("ItemsBasic.UpdateGoods", payload);
  if (u.data?.ResultCode !== 0) {
    throw new Error(`Update #${seq} failed: ${u.data?.ResultMsg}`);
  }

  const detail = await readDetail(itemCode);
  const title = String(detail.ItemTitle || "");
  const matched = title.includes(expectedMarker);
  if (!matched) {
    throw new Error(`Read-back mismatch #${seq}: marker not found (${expectedMarker})`);
  }
  return {
    seq,
    resultCode: u.data?.ResultCode,
    resultMsg: u.data?.ResultMsg,
    readBackTitle: title,
    matched,
  };
}

async function main() {
  const runBase = Date.now().toString().slice(-8);
  const beforeTotals = await getStatusTotals();

  const picked = await pickTargetItemCode();
  const itemCode = picked.itemCode;

  const beforeDetail = await readDetail(itemCode);
  const originalTitle = String(beforeDetail.ItemTitle || "");

  const m1 = marker(runBase, "A");
  const m2 = marker(runBase, "B");

  const p1 = buildUpdatePayload(beforeDetail, itemCode, applyMarkerTitle(originalTitle, m1));
  const ev1 = await updateOnce(itemCode, p1, m1, 1);

  const d2 = await readDetail(itemCode);
  const p2 = buildUpdatePayload(d2, itemCode, applyMarkerTitle(originalTitle, m2));
  const ev2 = await updateOnce(itemCode, p2, m2, 2);

  const afterTotals = await getStatusTotals();
  const accumulationSignal = JSON.stringify(beforeTotals) !== JSON.stringify(afterTotals);
  if (accumulationSignal) {
    throw new Error(`Accumulation signal detected: totals changed ${JSON.stringify({ beforeTotals, afterTotals })}`);
  }

  const evidence = {
    ok: true,
    timestamp: new Date().toISOString(),
    methodUpdate: "ItemsBasic.UpdateGoods",
    methodReadBack: "ItemsLookup.GetItemDetailInfo",
    methodList: "ItemsLookup.GetAllGoodsInfo",
    target: {
      itemCode,
      source: picked.source,
      sellerCode: beforeDetail.SellerCode,
      secondSubCat: beforeDetail.SecondSubCatCd,
    },
    runs: [ev1, ev2],
    beforeTotals,
    afterTotals,
    accumulationSignal,
  };

  const outDir = path.join(__dirname, "..", "logs");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `qoo10-update-overwrite-proof-${runBase}.json`);
  fs.writeFileSync(outPath, JSON.stringify(evidence, null, 2));

  console.log("[OK] overwrite-only proof complete");
  console.log(`[EVIDENCE] ${outPath}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`[STOP] ${err.message}`);
  process.exit(1);
});
