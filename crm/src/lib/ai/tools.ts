import { z } from "zod";
import { tool } from "ai";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const aiTools = {
  searchCustomers: tool({
    description:
      "Search customers by name, company, email, or country. Returns matching customer list.",
    inputSchema: z.object({
      query: z.string().describe("Search keyword (name, company, email, or country)"),
    }),
    execute: async ({ query }) => {
      const customers = await prisma.customer.findMany({
        where: {
          OR: [
            { customer_name: { contains: query, mode: "insensitive" } },
            { company_name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { country: { contains: query, mode: "insensitive" } },
          ],
        },
        take: 10,
        select: {
          customer_id: true,
          customer_name: true,
          company_name: true,
          email: true,
          phone: true,
          country: true,
        },
      });
      return customers;
    },
  }),

  searchInvoices: tool({
    description:
      "Search invoices by number, customer name, or status. Returns matching invoices.",
    inputSchema: z.object({
      query: z.string().optional().describe("Invoice number or customer name"),
      status: z
        .string()
        .optional()
        .describe("Invoice status filter (paid, sent, overdue, draft, void)"),
      limit: z.number().optional().default(10).describe("Max results"),
    }),
    execute: async ({ query, status, limit }) => {
      const where: Prisma.InvoiceWhereInput = {};
      if (query) {
        where.OR = [
          { invoice_number: { contains: query, mode: "insensitive" } },
          { customer_name: { contains: query, mode: "insensitive" } },
        ];
      }
      if (status) {
        where.status = status;
      }
      const invoices = await prisma.invoice.findMany({
        where,
        take: limit,
        orderBy: { date: "desc" },
        select: {
          invoice_id: true,
          invoice_number: true,
          customer_name: true,
          status: true,
          date: true,
          due_date: true,
          total: true,
          balance: true,
          currency_code: true,
        },
      });
      return invoices.map((inv) => ({
        ...inv,
        total: inv.total ? Number(inv.total) : null,
        balance: inv.balance ? Number(inv.balance) : null,
      }));
    },
  }),

  getCustomerInvoices: tool({
    description:
      "Get all invoices for a specific customer by customer ID or name. Includes line items.",
    inputSchema: z.object({
      customer_id: z.string().optional().describe("Customer ID"),
      customer_name: z.string().optional().describe("Customer name to search"),
    }),
    execute: async ({ customer_id, customer_name }) => {
      let cid = customer_id;
      if (!cid && customer_name) {
        const c = await prisma.customer.findFirst({
          where: { customer_name: { contains: customer_name, mode: "insensitive" } },
          select: { customer_id: true },
        });
        cid = c?.customer_id;
      }
      if (!cid) return { error: "Customer not found" };

      const invoices = await prisma.invoice.findMany({
        where: { customer_id: cid },
        orderBy: { date: "desc" },
        take: 20,
        include: {
          lineItems: {
            select: { name: true, sku: true, quantity: true, item_total: true },
          },
        },
      });
      return invoices.map((inv) => ({
        invoice_number: inv.invoice_number,
        status: inv.status,
        date: inv.date,
        total: inv.total ? Number(inv.total) : null,
        balance: inv.balance ? Number(inv.balance) : null,
        currency_code: inv.currency_code,
        items: inv.lineItems.map((li) => ({
          name: li.name,
          sku: li.sku,
          quantity: li.quantity ? Number(li.quantity) : null,
          total: li.item_total ? Number(li.item_total) : null,
        })),
      }));
    },
  }),

  getProductionOrders: tool({
    description:
      "Get production orders, optionally filtered by status. Returns order details with invoice info.",
    inputSchema: z.object({
      status: z
        .string()
        .optional()
        .describe(
          "Filter by status: confirmed, producing, checking, packing, shipped",
        ),
      limit: z.number().optional().default(10),
    }),
    execute: async ({ status, limit }) => {
      const where: Prisma.ProductionOrderWhereInput = {};
      if (status) where.status = status;

      const orders = await prisma.productionOrder.findMany({
        where,
        take: limit,
        orderBy: { created_at: "desc" },
        include: {
          invoice: {
            select: {
              invoice_number: true,
              customer_name: true,
              total: true,
              currency_code: true,
            },
          },
        },
      });
      return orders.map((o) => ({
        id: o.id,
        status: o.status,
        priority: o.priority,
        target_date: o.target_date,
        shipping_deadline: o.shipping_deadline,
        tracking_number: o.tracking_number,
        invoice_number: o.invoice.invoice_number,
        customer_name: o.invoice.customer_name,
        total: o.invoice.total ? Number(o.invoice.total) : null,
        currency: o.invoice.currency_code,
      }));
    },
  }),

  getDistributors: tool({
    description:
      "Get distributor list, optionally filtered by country or stage.",
    inputSchema: z.object({
      country: z.string().optional().describe("Country code filter"),
      stage: z.string().optional().describe("Pipeline stage filter"),
    }),
    execute: async ({ country, stage }) => {
      const where: Prisma.DistributorWhereInput = {};
      if (country) where.country_code = country;
      if (stage) where.stage = stage;

      const distributors = await prisma.distributor.findMany({
        where,
        take: 20,
        orderBy: { updated_at: "desc" },
        select: {
          id: true,
          company_name: true,
          contact_name: true,
          email: true,
          country_code: true,
          country_name: true,
          stage: true,
          product_scope: true,
          products: true,
        },
      });
      return distributors;
    },
  }),

  searchLeads: tool({
    description:
      "Search lead inquiries by name, company, email, country, or deal status. Returns matching leads from Google Sheets sync.",
    inputSchema: z.object({
      query: z
        .string()
        .optional()
        .describe("Search keyword (name, company, email, country)"),
      deal_status: z
        .string()
        .optional()
        .describe(
          "Filter by deal status: new, contacted, qualified, converted, lost",
        ),
      country: z.string().optional().describe("Filter by country"),
      limit: z.number().optional().default(10),
    }),
    execute: async ({ query, deal_status, country, limit }) => {
      const where: Prisma.LeadWhereInput = {};
      if (query) {
        where.OR = [
          { name: { contains: query, mode: "insensitive" } },
          { company: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
          { country: { contains: query, mode: "insensitive" } },
          { product_interest: { contains: query, mode: "insensitive" } },
        ];
      }
      if (deal_status) where.deal_status = deal_status;
      if (country) where.country = { contains: country, mode: "insensitive" };

      const leads = await prisma.lead.findMany({
        where,
        take: limit,
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          name: true,
          company: true,
          email: true,
          country: true,
          source: true,
          product_interest: true,
          deal_status: true,
          order_status: true,
          amount: true,
          notes: true,
          date: true,
          message: true,
        },
      });
      return leads.map((l) => ({
        ...l,
        amount: l.amount ? Number(l.amount) : null,
      }));
    },
  }),

  getBusinessSummary: tool({
    description:
      "Get a summary of the business: total invoices, revenue, customers, production status, etc.",
    inputSchema: z.object({}),
    execute: async () => {
      const [
        invoiceCount,
        customerCount,
        distributorCount,
        productionCounts,
        revenueResult,
      ] = await Promise.all([
        prisma.invoice.count(),
        prisma.customer.count(),
        prisma.distributor.count(),
        prisma.productionOrder.groupBy({
          by: ["status"],
          _count: true,
        }),
        prisma.$queryRaw<
          { total_revenue: number; total_balance: number }[]
        >`SELECT COALESCE(SUM(total), 0)::float AS total_revenue, COALESCE(SUM(balance), 0)::float AS total_balance FROM invoices`,
      ]);

      return {
        invoices: invoiceCount,
        customers: customerCount,
        distributors: distributorCount,
        production: productionCounts.map((p) => ({
          status: p.status,
          count: p._count,
        })),
        revenue: revenueResult[0]?.total_revenue ?? 0,
        outstanding_balance: revenueResult[0]?.total_balance ?? 0,
      };
    },
  }),

  searchEmails: tool({
    description:
      "Search emails by subject, sender, content, or customer name. Returns matching email conversations.",
    inputSchema: z.object({
      query: z.string().optional().describe("Search keyword (subject, sender, content)"),
      customer_name: z.string().optional().describe("Filter by customer name"),
      is_inbound: z.boolean().optional().describe("Filter: true=received, false=sent"),
      limit: z.number().optional().default(10),
    }),
    execute: async ({ query, customer_name, is_inbound, limit }) => {
      const where: Prisma.EmailWhereInput = {};
      if (query) {
        where.OR = [
          { subject: { contains: query, mode: "insensitive" } },
          { from_email: { contains: query, mode: "insensitive" } },
          { from_name: { contains: query, mode: "insensitive" } },
          { body_text: { contains: query, mode: "insensitive" } },
          { snippet: { contains: query, mode: "insensitive" } },
        ];
      }
      if (customer_name) {
        const customer = await prisma.customer.findFirst({
          where: { customer_name: { contains: customer_name, mode: "insensitive" } },
          select: { customer_id: true },
        });
        if (customer) where.customer_id = customer.customer_id;
      }
      if (is_inbound !== undefined) where.is_inbound = is_inbound;

      const emails = await prisma.email.findMany({
        where,
        take: limit,
        orderBy: { date: "desc" },
        select: {
          id: true,
          from_email: true,
          from_name: true,
          to_emails: true,
          subject: true,
          snippet: true,
          date: true,
          is_inbound: true,
          customer_id: true,
          contact_email: true,
          customer: {
            select: { customer_name: true, company_name: true },
          },
        },
      });
      return emails;
    },
  }),

  getEmailThread: tool({
    description:
      "Get full email thread/conversation by email ID or contact email address.",
    inputSchema: z.object({
      email_id: z.number().optional().describe("Email ID to get thread for"),
      contact_email: z.string().optional().describe("Contact email address to find conversation"),
    }),
    execute: async ({ email_id, contact_email }) => {
      let threadContact = contact_email;

      if (email_id && !threadContact) {
        const email = await prisma.email.findUnique({
          where: { id: email_id },
          select: { contact_email: true },
        });
        threadContact = email?.contact_email ?? undefined;
      }

      if (!threadContact) return { error: "Email not found" };

      const emails = await prisma.email.findMany({
        where: { contact_email: threadContact },
        orderBy: { date: "asc" },
        take: 20,
        select: {
          id: true,
          from_email: true,
          from_name: true,
          subject: true,
          body_text: true,
          date: true,
          is_inbound: true,
        },
      });

      return {
        contact_email: threadContact,
        email_count: emails.length,
        emails: emails.map((e) => ({
          ...e,
          body_text: e.body_text?.slice(0, 500) ?? null,
        })),
      };
    },
  }),
};
