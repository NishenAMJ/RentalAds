/** WhatsApp message templates for the admin team. Wording avoids promising a match or a response time. */
export interface TemplateContext { area: string }
export interface MessageTemplate { id: string; label: string; render: (context: TemplateContext) => string }

const area = (context: TemplateContext) => context.area.trim() || "your preferred area";

export const MESSAGE_TEMPLATES: readonly MessageTemplate[] = [
  {
    id: "first-contact",
    label: "First contact",
    render: (c) => `Hello, this is the RentalHub Sri Lanka team. We received your private request for ${area(c)}. May we confirm a few details so we can look for the right home?`,
  },
  {
    id: "potential-match",
    label: "Potential match",
    render: (c) => `Hello, this is the RentalHub Sri Lanka team. We may have a potential home for your request in ${area(c)}. Would you like us to share the details?`,
  },
  {
    id: "follow-up",
    label: "Follow-up",
    render: (c) => `Hello, this is the RentalHub Sri Lanka team following up on your request for ${area(c)}. Are you still looking? Please tell us if your preferences have changed.`,
  },
  {
    id: "no-match-yet",
    label: "No match yet",
    render: (c) => `Hello, this is the RentalHub Sri Lanka team. We have not found a suitable home for ${area(c)} yet. We will keep looking and contact you if there is a potential fit. You can update your preferences at any time.`,
  },
];

export function renderTemplate(id: string, context: TemplateContext): string {
  const template = MESSAGE_TEMPLATES.find((item) => item.id === id);
  if (!template) throw new Error(`Unknown message template: ${id}`);
  return template.render(context);
}
