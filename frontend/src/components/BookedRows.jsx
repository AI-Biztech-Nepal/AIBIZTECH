/**
 * BookedRows.jsx — a booked vehicle as a row of the Sales page's table (BookedTableRow, sm and up) or as a card on phones
 * (BookedCard). It sits in the same list as the sales, with a "Booked" status; a sale has no status there.
 *
 * b: the booking as GET /bookings returns it. index: its SN. cost: the vehicle's overall cost price, or null. isAdmin:
 * withdrawing and deleting are for admins. actions: { onSell, onReceipt, onEdit, onWithdraw, onDelete }, each called with
 * the booking.
 */
import { Pencil, Printer, Trash2, Undo2, ArrowRight } from "lucide-react";
import { formatNPR } from "../utils/helpers";
import HoverADDate from "./HoverADDate";

// What the vehicle is to be sold for: the price agreed with the customer, else the vehicle's own selling price.
export const agreedOf = (b) => b.agreed_price ?? b.vehicle_selling_price ?? null;

export const BookedStatus = () => (
  <span className="px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide whitespace-nowrap bg-yellow-100 text-yellow-800" data-testid="booking-status-tag">Booked</span>
);

const Dash = () => <span className="text-gray-300">—</span>;

const ICON_BTN = "max-md:min-w-11 max-md:min-h-11 max-md:inline-flex max-md:items-center max-md:justify-center p-1.5 rounded-lg transition-colors";

function BookedActions({ b, isAdmin, actions }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <button onClick={() => actions.onSell(b)} data-testid="booking-record-sale-btn" className="flex items-center gap-1.5 h-9 px-3 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold active:scale-95 transition-all whitespace-nowrap">
        Sale Vehicle <ArrowRight size={13} />
      </button>
      <button onClick={() => actions.onReceipt(b)} title="Print receipt" data-testid="booking-receipt-btn" className={`${ICON_BTN} hover:bg-slate-100`}><Printer size={14} className="text-slate-500" /></button>
      <button onClick={() => actions.onEdit(b)} title="Edit booking" data-testid="booking-edit-btn" className={`${ICON_BTN} hover:bg-slate-100`}><Pencil size={14} className="text-slate-500" /></button>
      {isAdmin && <button onClick={() => actions.onWithdraw(b)} title="Customer withdraws" data-testid="booking-withdraw-btn" className={`${ICON_BTN} hover:bg-amber-50`}><Undo2 size={14} className="text-amber-700" /></button>}
      {isAdmin && <button onClick={() => actions.onDelete(b)} title="Delete booking" data-testid="booking-delete-btn" className={`${ICON_BTN} hover:bg-red-50`}><Trash2 size={14} className="text-red-400" /></button>}
    </div>
  );
}

// The cells line up with the Sales table's columns: SN, Date, Vehicle, Customer, Transfer, Sale Price, Cost Price, Profit,
// Payment. The table has no Status or actions column, so the "Booked" status and the buttons are in the Vehicle cell.
export function BookedTableRow({ b, index, cost, isAdmin, actions }) {
  const agreed = agreedOf(b);
  return (
    <tr data-testid="booking-row">
      <td className="text-gray-500">{index}</td>
      <td className="text-gray-500 whitespace-nowrap"><HoverADDate date={b.booking_date} /></td>
      <td className="min-w-[16rem]">
        <div className="font-semibold text-gray-900">{b.vehicle_info || "—"}</div>
        <div className="flex items-center gap-1 flex-wrap mt-1"><BookedStatus /></div>
        {b.notes && <div className="text-xs text-gray-400 truncate max-w-[16rem] mt-1">{b.notes}</div>}
        <div className="mt-2"><BookedActions b={b} isAdmin={isAdmin} actions={actions} /></div>
      </td>
      <td>
        <div className="text-gray-700">{b.customer_name}</div>
        {b.customer_contact && <div className="text-xs text-gray-400">{b.customer_contact}</div>}
      </td>
      <td><Dash /></td>
      <td className="text-right font-medium text-gray-800 whitespace-nowrap">{agreed != null ? formatNPR(agreed) : <Dash />}</td>
      <td className="text-right font-medium text-gray-800 whitespace-nowrap" data-testid="booking-cost-price">{cost != null ? formatNPR(cost) : <Dash />}</td>
      <td className="text-right"><Dash /></td>
      <td>
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">{b.payment_method}</span>
        <div className="mt-1 text-xs font-semibold text-amber-700 whitespace-nowrap">Deposit: {formatNPR(b.booking_amount)}</div>
      </td>
    </tr>
  );
}

export function BookedCard({ b, cost, isAdmin, actions }) {
  return (
    <div data-testid="booking-row-mobile" className="p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-slate-900 text-sm truncate">{b.vehicle_info || "—"}</div>
          <div className="text-xs text-slate-500 mt-0.5 truncate">{b.customer_name}{b.customer_contact ? ` · ${b.customer_contact}` : ""}</div>
        </div>
        <BookedStatus />
      </div>
      <div className="text-sm">
        <span className="font-bold text-green-700">{formatNPR(b.booking_amount)} <span className="text-xs font-normal text-slate-400">{b.payment_method} deposit</span></span>
      </div>
      {cost != null && <div className="text-xs text-slate-500">Cost price <span className="font-semibold text-slate-700">{formatNPR(cost)}</span></div>}
      <div className="text-xs text-slate-400"><HoverADDate date={b.booking_date} /></div>
      <BookedActions b={b} isAdmin={isAdmin} actions={actions} />
    </div>
  );
}
