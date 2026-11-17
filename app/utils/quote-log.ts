import {
  Ban,
  BadgeCheck,
  CalendarClock,
  CircleCheck,
  CircleX,
  Clock,
  Files,
  Send,
  ShoppingCart,
  Undo2,
} from 'lucide-vue-next';
import type { Component } from 'vue';
import type { QuoteStatus, QuoteThreadEventType } from '#shared/types/quote';
import { getQuoteStatusVariant } from './quote-status';

/** The icon of an event nobody wrote anything with: a line in the quote log. */
export const QUOTE_EVENT_ICONS: Record<QuoteThreadEventType, Component> = {
  request_sent: Send,
  quote_sent: Send,
  revision_sent: Files,
  accepted: CircleCheck,
  confirmed: BadgeCheck,
  declined: CircleX,
  withdrawn: Undo2,
  quote_rejected: CircleX,
  request_rejected: CircleX,
  ordered: ShoppingCart,
  canceled: Ban,
  expired: Clock,
  extended: CalendarClock,
};

/**
 * A status pill outlined so it reads on a tint. A solid badge has white text,
 * which on a white pill takes the badge's colour instead.
 */
export function outlinedStatusClass(status: QuoteStatus) {
  return [
    'bg-card border-current/30',
    getQuoteStatusVariant(status) === 'success-solid' && 'text-success',
  ];
}
