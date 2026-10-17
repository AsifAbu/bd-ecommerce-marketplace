/**
 * Public entry of the complaints feature (US-072). Pure rules and types only; the wired parts are
 * in `./server`:
 *
 *   complaintsService.open/reply/adminUpdate/flagOverdue
 *   complaintsApi.*                       the JSON route handlers
 *   complaintsOfUser/Order/Shop, complaintQueue, complaintDetail, customerComplaint   pages (scoped)
 *   flagOverdueComplaints, notifyComplaint  the worker jobs
 *   complaintStats({ shopId?, from, to })  metrics (US-083) and seller score (US-059): resolved
 *                                          within 72 h, median/average hours, overdue now
 */
export {
  ACTIVE_COMPLAINT_STATUSES,
  CATEGORY_LABELS,
  closedOnTime,
  COMPLAINT_CATEGORIES,
  COMPLAINT_STATUS_LABELS,
  COMPLAINT_STATUSES,
  complaintDueAt,
  ComplaintError,
  isOverdue,
  RESOLUTION_HOURS,
  type ComplaintCategory,
  type ComplaintStatus,
} from "./rules";
export type { TicketView } from "./views";
