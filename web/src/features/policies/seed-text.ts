import type { PolicySlug } from "./catalog";

/*
 * Version 1 of every policy, used by `npm run seed`. TEST WORDING ONLY, written from plan v2.4
 * ("Policy pages", "Return and refund policy", "Cash on delivery rules") and news summaries of
 * the Digital Commerce Operation Guidelines 2021. Pre-release checklist: replace with the
 * official text, reviewed by a lawyer, and add the Bengali Terms.
 */

const TEST_NOTE =
  "**[TEST] Draft wording for testing only.** This is not legal text. It will be replaced with reviewed text, and a Bengali version, before the public launch.";

export const SEED_POLICY_TEXT: Record<PolicySlug, { title: string; body: string }> = {
  terms: {
    title: "Terms and Conditions",
    body: `${TEST_NOTE}

## Who we are
This website is an online marketplace. Independent shops list and sell their products here. The platform does not sell products itself; each order is a contract between you and the shop that sells the item.

Digital Business ID (DBID): **{{DBID}}**

## Shops
- Every shop is approved by the Platform Admin before it can sell.
- Shops must describe products truthfully, with price, delivery charge, stock, images and return conditions.
- Shops must not sell expired, counterfeit, adulterated or prohibited goods.
- Medicine shops need a verified drug-administration licence.

## Your account
- Give true details and keep your password private. You are responsible for activity on your account.
- One account per person. Mobile numbers are verified by a one-time code.
- We may suspend accounts that break these terms, place fake orders or refuse deliveries repeatedly.

## Orders and payment
Payment is cash on delivery. Prices are in Bangladeshi Taka (BDT). Delivery charges are shown per shop before you place an order. See the Delivery and Cash on Delivery Policy and the Return and Refund Policy.

## Reviews
Only buyers can review a product. Shops and their staff can't review their own products. Reviews are never deleted; reviews that break the rules are hidden with a recorded reason.

## Complaints
You can raise a complaint about any order. We record every complaint and aim to resolve it within 72 hours.

## Governing law
These terms are governed by the laws of Bangladesh. Disputes are handled by the courts of Bangladesh.`,
  },

  privacy: {
    title: "Privacy Policy",
    body: `${TEST_NOTE}

## What we collect
- Account details: name, mobile number, email, password (stored only as a secure hash).
- Delivery addresses and order history.
- For shop owners: NID number, photo, registration numbers and licence documents.
- Technical data: IP address and browser type when you sign in or accept a policy.

## Why we collect it
To create your account, deliver your orders, prevent fraud and fake orders, resolve complaints and meet our legal duties. We ask for your consent before collecting personal data and record that consent.

## How long we keep it
Business records (orders, shops, complaints, payments, audit logs and policy acceptances) are kept for 6 years, as Bangladesh's Digital Commerce Operation Guidelines require. Other data is kept while your account is open.

## Who sees it
The shop you order from sees your name, mobile number and delivery address for that order. Delivery partners see what they need to deliver. We do not sell your data.

## Try-on photos
If virtual try-on is offered later, your photos are private, location data is removed, and results are deleted after 30 days. You can delete them at any time.

## Your choices
You can view and correct your details in your account. To delete your account, contact us; records we must keep by law are anonymised rather than deleted.

## Contact
For privacy questions or complaints, contact our compliance officer (to be named before launch).`,
  },

  returns: {
    title: "Return and Refund Policy",
    body: `${TEST_NOTE}

## Return window
You can request a return within **7 days** of delivery.

## Eligible reasons
- Damaged, defective or incomplete item.
- Wrong item, wrong size or wrong colour.
- Item not as described.
- Change of mind: fashion items only, unworn and with tags.

## Excluded items
Food and perishables, innerwear, medicine (unless wrong, damaged or expired), digital items and custom-made items.

## Process
1. Request a return in the app with a reason and photos.
2. The shop accepts or rejects within 48 hours. The Platform Admin decides disputes.
3. The item is collected or dropped off, then inspected.

## Refunds
For cash-on-delivery orders, refunds are recorded and paid to your bKash or bank account within 7 days of the return being accepted. The delivery charge is refunded when the shop is at fault.`,
  },

  delivery: {
    title: "Delivery and Cash on Delivery Policy",
    body: `${TEST_NOTE}

## Delivery charges
Each shop ships separately, so each shop order has one delivery charge:
- Inside Dhaka: **Tk 70** for up to 1 kg.
- Outside Dhaka: **Tk 130** for up to 1 kg.
- Plus Tk 20 for each extra kg.

Some shops offer free delivery above an order amount. The charge is shown per shop before you place the order and on your invoice.

## Handover and delivery
Shops hand your order to the courier within 48 hours. Delivery time depends on the courier: usually within 5 days in the same city and 10 days elsewhere.

## Cash on delivery
- Verify your mobile number with a one-time code before your first order.
- Pay the delivery person in cash when the order arrives, and get a printed bill.
- You can cancel free of charge until the shop hands the order over.

## Refused deliveries
Refusing cash-on-delivery orders without a valid reason may limit cash on delivery for your mobile number.`,
  },

  seller: {
    title: "Seller Policy",
    body: `${TEST_NOTE}

## Approval
Every shop applies with the owner's NID, photo and a verified mobile number. The Platform Admin approves shops before they can sell.

## Seller tiers
- **Basic:** up to 20 open orders and 100 live listings.
- **Verified:** adds a trade licence, VAT registration, TIN, UBID, PRA or DBID number with a document. No limits, and a "Verified seller" badge.
- **Medicine shops:** Verified, plus a drug-administration licence verified by the admin. Listings are hidden if the licence expires.

## Listing rules
Every product sits in one category and shows the required details: price, delivery charge, brand, model, country of origin, stock, images, return conditions and any health or safety risks.

## Prohibited items
Expired, counterfeit, adulterated or illegal goods, and anything the law of Bangladesh does not allow to be sold online.

## Orders and payouts
Hand orders to the courier within 48 hours. Cash-on-delivery money is paid to you within 10 days of delivery, minus the category commission.`,
  },

  cookies: {
    title: "Cookie Policy",
    body: `${TEST_NOTE}

## What cookies are
Cookies are small files a website stores in your browser.

## Cookies we use
- **Sign-in session:** keeps you logged in. Needed for the site to work.
- **Security:** protects forms against misuse. Needed for the site to work.
- **Cookie notice:** remembers that you closed this notice (kept for one year).

We do not use advertising or tracking cookies. If we add analytics later, we will update this policy and ask for your consent first.

## Managing cookies
You can delete cookies in your browser settings. If you block the sign-in cookie, you can't log in.`,
  },
};
