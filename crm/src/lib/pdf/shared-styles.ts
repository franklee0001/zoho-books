import { StyleSheet } from "@react-pdf/renderer";

export const colors = {
  black: "#000000",
  darkGray: "#333333",
  gray: "#666666",
  border: "#000000",
  headerBg: "#f5f5f5",
};

export const styles = StyleSheet.create({
  page: {
    padding: 40,
    paddingTop: 30,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: colors.black,
  },
  // Title
  title: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 20,
    textDecoration: "underline",
  },
  // Header area - 3 column text layout (no boxes)
  headerArea: {
    flexDirection: "row",
    marginBottom: 20,
  },
  headerLeft: {
    width: "42%",
  },
  headerCenter: {
    width: "33%",
  },
  headerRight: {
    width: "25%",
    alignItems: "flex-end",
  },
  headerSectionLabel: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  headerLine: {
    fontSize: 9,
    lineHeight: 1.5,
  },
  headerLineBold: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1.5,
  },
  // Right side info labels
  rightLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginTop: 8,
  },
  rightValue: {
    fontSize: 9,
    marginBottom: 2,
  },
  // Table
  table: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.headerBg,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 28,
  },
  tableCell: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    fontSize: 9,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    justifyContent: "center",
  },
  tableCellHeader: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    borderRightWidth: 1,
    borderRightColor: colors.border,
    justifyContent: "center",
    textAlign: "center",
  },
  tableCellRight: {
    textAlign: "right",
  },
  tableCellCenter: {
    textAlign: "center",
  },
  tableCellLast: {
    borderRightWidth: 0,
  },
});

// PL column widths
export const plColumns = {
  packingNo: { width: "9%", label: "PACKING NO." },
  description: { width: "22%", label: "DESCRIPTION" },
  modelNo: { width: "13%", label: "MODEL NO." },
  qty: { width: "8%", label: "QTY" },
  size: { width: "18%", label: "SIZE\n (mm)" },
  pkg: { width: "8%", label: "PKG" },
  netWeight: { width: "11%", label: "N.WEIGHT\n(KGS)" },
  grossWeight: { width: "11%", label: "G.WEIGHT\n(KGS)" },
};

// CI column widths
export const ciColumns = {
  type: { width: "9%", label: "TYPE" },
  no: { width: "7%", label: "NO." },
  description: { width: "20%", label: "DESCRIPTION" },
  modelNo: { width: "12%", label: "MODEL NO." },
  qty: { width: "8%", label: "QTY" },
  unitPrice: { width: "13%", label: "UNIT PRICE" },
  subAmount: { width: "17%", label: "SUB AMOUNT" },
  packingType: { width: "14%", label: "PACKING TYPE" },
};
