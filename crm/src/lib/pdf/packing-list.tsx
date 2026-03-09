import React from "react";
import { Document, Page, View, Text } from "@react-pdf/renderer";
import { styles, plColumns } from "./shared-styles";

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

interface LineItemWithPacking {
  line_item_id: string;
  name: string | null;
  sku: string | null;
  quantity: number;
  packingNo: number;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  packageType: string | null;
  netWeightKg: number | null;
  grossWeightKg: number | null;
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
  packing_type: string | null;
}

interface PackingListProps {
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
  items: LineItemWithPacking[];
}

function formatSize(l: number | null, w: number | null, h: number | null): string {
  if (l == null && w == null && h == null) return "";
  return `${l ?? "-"}*${w ?? "-"}*${h ?? "-"}`;
}

function formatWeight(n: number | null): string {
  if (n == null) return "";
  return n.toFixed(1);
}

export default function PackingListPDF({
  invoiceNumber,
  invoiceDate,
  seller,
  buyer,
  destination,
  items,
}: PackingListProps) {
  // Destination country for right side
  const destCountry = destination?.country ?? buyer.address?.country ?? "";

  const cols = Object.entries(plColumns);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Title */}
        <Text style={styles.title}>PACKING LIST</Text>

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

          {/* Right side: DESTINATION, INVOICE NO, DATE */}
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
          {items.map((item) => (
            <View key={item.line_item_id} style={styles.tableRow}>
              <View style={[styles.tableCell, { width: plColumns.packingNo.width }, styles.tableCellCenter]}>
                <Text>{item.packingNo}</Text>
              </View>
              <View style={[styles.tableCell, { width: plColumns.description.width }]}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{item.name ?? ""}</Text>
              </View>
              <View style={[styles.tableCell, { width: plColumns.modelNo.width }, styles.tableCellCenter]}>
                <Text>{item.sku ?? ""}</Text>
              </View>
              <View style={[styles.tableCell, { width: plColumns.qty.width }, styles.tableCellCenter]}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{item.quantity}</Text>
              </View>
              <View style={[styles.tableCell, { width: plColumns.size.width }, styles.tableCellCenter]}>
                <Text>{formatSize(item.lengthMm, item.widthMm, item.heightMm)}</Text>
              </View>
              <View style={[styles.tableCell, { width: plColumns.pkg.width }, styles.tableCellCenter]}>
                <Text>{1}</Text>
              </View>
              <View style={[styles.tableCell, { width: plColumns.netWeight.width }, styles.tableCellCenter]}>
                <Text>{formatWeight(item.netWeightKg)}</Text>
              </View>
              <View style={[styles.tableCell, { width: plColumns.grossWeight.width }, styles.tableCellCenter, styles.tableCellLast]}>
                <Text>{formatWeight(item.grossWeightKg)}</Text>
              </View>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
