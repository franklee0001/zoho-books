import React from "react";
import { Document, Page, View, Text } from "@react-pdf/renderer";
import { styles, ciColumns } from "./shared-styles";

interface Address {
  attention: string | null;
  address: string | null;
  street2: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
  country: string | null;
  phone: string | null;
}

interface LineItemCI {
  line_item_id: string;
  name: string | null;
  sku: string | null;
  quantity: number;
  rate: number;
  itemTotal: number;
  packageType: string | null;
}

interface Settings {
  company_name: string | null;
  contact_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  dhl_account: string | null;
  incoterms: string | null;
  origin_country: string | null;
  exporter_code: string | null;
  packing_type: string | null;
}

interface CommercialInvoiceProps {
  invoiceNumber: string;
  invoiceDate: string; // MMM/DD/YY format
  seller: Settings;
  buyer: {
    name: string | null;
    email: string | null;
    phone: string | null;
    address: Address | null;
  };
  destination: Address | null;
  items: LineItemCI[];
  totalAmount: number;
}

function formatUnitPrice(n: number): string {
  // $578.572 format (3 decimals)
  return `$${n.toFixed(3)}`;
}

function formatAmount(n: number): string {
  // $ 4,050.00 format — split into $ and number
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CommercialInvoicePDF({
  invoiceNumber,
  invoiceDate,
  seller,
  buyer,
  destination,
  items,
  totalAmount,
}: CommercialInvoiceProps) {
  const destCountry = destination?.country ?? buyer.address?.country ?? "";
  const incoterms = seller.incoterms ?? "FOB";
  const exporterCode = seller.exporter_code ?? "";
  const originCountry = seller.origin_country ?? "Republic of Korea";

  const cols = Object.entries(ciColumns);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Title */}
        <Text style={styles.title}>COMMERCIAL INVOICE</Text>

        {/* Header: SELLER / BUYER / Right info */}
        <View style={styles.headerArea}>
          {/* SELLER */}
          <View style={styles.headerLeft}>
            <Text style={styles.headerSectionLabel}>SELLER:</Text>
            <Text style={styles.headerLine}>Company: {seller.company_name ?? ""}</Text>
            {seller.contact_name && (
              <Text style={styles.headerLine}>Contact: {seller.contact_name}</Text>
            )}
            {seller.address && <Text style={styles.headerLine}>{seller.address}</Text>}
            {(seller.city || seller.state || seller.country) && (
              <Text style={styles.headerLine}>
                {[seller.city, seller.state, seller.country].filter(Boolean).join(", ")}
              </Text>
            )}
            {seller.email && (
              <Text style={styles.headerLine}>Mail: {seller.email}</Text>
            )}
            {seller.phone && (
              <Text style={styles.headerLine}>Phone: {seller.phone}</Text>
            )}
          </View>

          {/* BUYER */}
          <View style={styles.headerCenter}>
            <Text style={styles.headerSectionLabel}>BUYER:</Text>
            {buyer.name && (
              <Text style={styles.headerLine}>Contact: {buyer.name}</Text>
            )}
            {buyer.address?.address && (
              <Text style={styles.headerLine}>{buyer.address.address}</Text>
            )}
            {buyer.address?.street2 && (
              <Text style={styles.headerLine}>{buyer.address.street2}</Text>
            )}
            {buyer.address?.city && (
              <Text style={styles.headerLine}>{buyer.address.city}</Text>
            )}
            {(buyer.address?.zipcode || buyer.address?.state) && (
              <Text style={styles.headerLine}>
                {[buyer.address.zipcode, buyer.address.state].filter(Boolean).join(" ")}
              </Text>
            )}
            {buyer.address?.country && (
              <Text style={styles.headerLine}>{buyer.address.country}</Text>
            )}
            {buyer.email && (
              <Text style={{ ...styles.headerLine, marginTop: 4 }}>
                Mail: {buyer.email}
              </Text>
            )}
            {buyer.phone && (
              <Text style={styles.headerLine}>
                Phone:{buyer.phone}
              </Text>
            )}
          </View>

          {/* Right side */}
          <View style={styles.headerRight}>
            <Text style={styles.rightLabel}>DESTINATION:</Text>
            <Text style={styles.rightValue}>{destCountry}</Text>

            <Text style={styles.rightLabel}>INVOICE NO:</Text>
            <Text style={styles.rightValue}>{invoiceNumber}</Text>

            <Text style={styles.rightLabel}>DATE:</Text>
            <Text style={styles.rightValue}>{invoiceDate}</Text>
          </View>
        </View>

        {/* Table */}
        <View style={styles.table}>
          {/* Header row */}
          <View style={styles.tableHeader}>
            {cols.map(([key, col], i) => (
              <View
                key={key}
                style={[
                  styles.tableCellHeader,
                  { width: col.width },
                  i === cols.length - 1 ? styles.tableCellLast : {},
                ]}
              >
                <Text>{col.label}</Text>
              </View>
            ))}
          </View>

          {/* Data rows */}
          {items.map((item, idx) => (
            <View key={item.line_item_id} style={styles.tableRow}>
              <View style={[styles.tableCell, { width: ciColumns.type.width }, styles.tableCellCenter]}>
                <Text></Text>
              </View>
              <View style={[styles.tableCell, { width: ciColumns.no.width }, styles.tableCellCenter]}>
                <Text>{idx + 1}</Text>
              </View>
              <View style={[styles.tableCell, { width: ciColumns.description.width }]}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{item.name ?? ""}</Text>
              </View>
              <View style={[styles.tableCell, { width: ciColumns.modelNo.width }, styles.tableCellCenter]}>
                <Text>{item.sku ?? ""}</Text>
              </View>
              <View style={[styles.tableCell, { width: ciColumns.qty.width }, styles.tableCellCenter]}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{item.quantity}</Text>
              </View>
              <View style={[styles.tableCell, { width: ciColumns.unitPrice.width }, styles.tableCellRight]}>
                <Text>{formatUnitPrice(item.rate)}</Text>
              </View>
              <View style={[styles.tableCell, { width: ciColumns.subAmount.width }, styles.tableCellRight]}>
                <Text>$ {formatAmount(item.itemTotal)}</Text>
              </View>
              <View style={[styles.tableCell, { width: ciColumns.packingType.width }, styles.tableCellCenter, styles.tableCellLast]}>
                <Text>{item.packageType ?? seller.packing_type ?? ""}</Text>
              </View>
            </View>
          ))}

          {/* INCOTERMS + TOTAL AMOUNT row */}
          <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
            {/* [INCOTERMS : FOB] spans TYPE+NO columns */}
            <View style={[styles.tableCell, { width: "16%", borderRightWidth: 0 }]}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8 }}>
                [INCOTERMS : {incoterms}]
              </Text>
            </View>
            {/* DESCRIPTION + MODEL NO + QTY empty */}
            <View style={[styles.tableCell, { width: "20%", borderRightWidth: 0 }]}>
              <Text></Text>
            </View>
            <View style={[styles.tableCell, { width: "12%", borderRightWidth: 0 }]}>
              <Text></Text>
            </View>
            <View style={[styles.tableCell, { width: "8%", borderRightWidth: 1, borderRightColor: "#000" }]}>
              <Text></Text>
            </View>
            {/* TOTAL AMOUNT label in UNIT PRICE column */}
            <View style={[styles.tableCell, { width: "13%", borderRightWidth: 0 }]}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8 }}>TOTAL AMOUNT</Text>
            </View>
            {/* Total value in SUB AMOUNT column */}
            <View style={[styles.tableCell, { width: "17%" }, styles.tableCellRight]}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>$ {formatAmount(totalAmount)}</Text>
            </View>
            {/* Empty PACKING TYPE */}
            <View style={[styles.tableCell, { width: "14%" }, styles.tableCellLast]}>
              <Text></Text>
            </View>
          </View>
        </View>

        {/* Origin Declaration */}
        <View style={{ marginTop: 20 }}>
          <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", lineHeight: 1.6 }}>
            The exporter of the products covered by this document ({exporterCode}) declares that,
          </Text>
          <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", lineHeight: 1.6 }}>
            except where otherwise clearly indicated, these products are of the {originCountry} preferential origin.
          </Text>
        </View>

        {/* DHL Account */}
        {seller.dhl_account && (
          <View style={{ marginTop: 30, alignItems: "center" }}>
            <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold" }}>
              DHL ACCOUNT  –  {seller.dhl_account}
            </Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
