import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { formatMoney } from "../shared/pricing.js";
import { invoiceWithTotals } from "./services.js";

type Payload = NonNullable<Awaited<ReturnType<typeof invoiceWithTotals>>>;

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    fontFamily: "Times-Roman",
    color: "#243028",
  },
  row: { flexDirection: "row", justifyContent: "space-between" },
  brand: { fontSize: 22, fontFamily: "Times-Bold", letterSpacing: 2 },
  tag: { fontSize: 9, fontStyle: "italic", marginTop: 2 },
  muted: { color: "#5c6b62", fontSize: 9 },
  h: { fontSize: 16, fontFamily: "Times-Bold", marginTop: 16, marginBottom: 8 },
  tableHead: {
    flexDirection: "row",
    borderBottom: "1 solid #243028",
    paddingBottom: 4,
    marginTop: 8,
    fontFamily: "Times-Bold",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottom: "0.5 solid #d9d0c4",
  },
  colDesc: { width: "62%" },
  colQty: { width: "13%", textAlign: "right" },
  colTot: { width: "25%", textAlign: "right" },
  desc: { fontSize: 8, color: "#5c6b62", marginTop: 2, lineHeight: 1.3 },
  totals: { marginTop: 12, width: 220, alignSelf: "flex-end" },
  totRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  terms: { marginTop: 18, fontSize: 8, lineHeight: 1.4, color: "#5c6b62" },
  sign: { flexDirection: "row", justifyContent: "space-between", marginTop: 28 },
  signLine: { width: "42%", borderTop: "0.5 solid #243028", paddingTop: 4, fontSize: 8 },
});

function PdfDoc({ invoice, totals, settings }: Payload) {
  const e = invoice.event;
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.row}>
          <View>
            <Text style={styles.brand}>AGAPE</Text>
            <Text style={styles.muted}>CATERING</Text>
            <Text style={styles.tag}>{settings.tagline}</Text>
          </View>
          <View>
            <Text>{settings.address}</Text>
            <Text>{settings.phone}</Text>
            <Text>{settings.email}</Text>
          </View>
        </View>

        <Text style={styles.h}>PROPOSAL</Text>
        <View style={styles.row}>
          <View>
            <Text>TO: {e.clientName}</Text>
            {e.contactName ? <Text>Contact: {e.contactName}</Text> : null}
            {e.venue ? <Text>{e.venue}</Text> : null}
            {e.phone ? <Text>PHONE: {e.phone}</Text> : null}
            {(e as { email?: string }).email ? (
              <Text>EMAIL: {(e as { email?: string }).email}</Text>
            ) : null}
          </View>
          <View>
            <Text>Date {e.proposalDate || invoice.createdAt.toISOString().slice(0, 10)}</Text>
            <Text>Event Date {e.eventDate}</Text>
            {e.eventName ? <Text>{e.eventName}</Text> : null}
            <Text>Guests {e.guestCount}</Text>
            <Text>Invoice v{invoice.version}</Text>
          </View>
        </View>

        <View style={styles.tableHead}>
          <Text style={styles.colDesc}>DESCRIPTION</Text>
          <Text style={styles.colQty}>QTY</Text>
          <Text style={styles.colTot}>TOTAL</Text>
        </View>
        {invoice.lines.map((line) => {
          const qty = line.type === "TBD" ? "—" : String(line.qty);
              const total =
            line.type === "TBD"
              ? "Quote later"
              : line.type === "PERCENT_DISCOUNT"
                ? `${(line.unitCents / 100).toFixed(1)}%`
                : formatMoney(
                    line.type === "FIXED_DISCOUNT"
                      ? -Math.abs(line.unitCents * line.qty)
                      : line.unitCents * line.qty,
                  );
          return (
            <View key={line.id} style={styles.tableRow} wrap={false}>
              <View style={styles.colDesc}>
                <Text>
                  {line.label}
                  {line.type === "PER_PERSON" ? `  ${formatMoney(line.unitCents)} per person` : ""}
                </Text>
                {line.description ? <Text style={styles.desc}>{line.description}</Text> : null}
              </View>
              <Text style={styles.colQty}>{qty}</Text>
              <Text style={styles.colTot}>{total}</Text>
            </View>
          );
        })}

        <View style={styles.totals}>
          <View style={styles.totRow}>
            <Text>Sub Total</Text>
            <Text>{formatMoney(totals.subtotalCents)}</Text>
          </View>
          <View style={styles.totRow}>
            <Text>Tax</Text>
            <Text>{formatMoney(totals.taxCents)}</Text>
          </View>
          <View style={styles.totRow}>
            <Text>Deposit</Text>
            <Text>{formatMoney(Math.min(totals.depositDueCents, totals.paidCents || totals.depositDueCents))}</Text>
          </View>
          <View style={[styles.totRow, { marginTop: 4 }]}>
            <Text style={{ fontFamily: "Times-Bold" }}>TOTAL</Text>
            <Text style={{ fontFamily: "Times-Bold" }}>{formatMoney(totals.totalCents)}</Text>
          </View>
          <View style={styles.totRow}>
            <Text>Paid</Text>
            <Text>{formatMoney(totals.paidCents)}</Text>
          </View>
          <View style={styles.totRow}>
            <Text>Balance due</Text>
            <Text>{formatMoney(totals.balanceCents)}</Text>
          </View>
        </View>

        <Text style={styles.terms}>{invoice.terms || settings.terms}</Text>
        <Text style={[styles.terms, { marginTop: 6 }]}>Thank You!</Text>

        <View style={styles.sign}>
          <Text style={styles.signLine}>Client</Text>
          <Text style={styles.signLine}>Caterer — Laura A. Stephens</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(payload: Payload) {
  return renderToBuffer(<PdfDoc {...payload} />);
}
