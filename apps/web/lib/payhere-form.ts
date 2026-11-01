import type { CheckoutRequest } from "@/lib/items";

/**
 * Sends the browser to PayHere's hosted payment page. PayHere only accepts a form POST, so the fields the API
 * signed are put in a hidden form and submitted. The API signs the amount, so changing a field here fails at PayHere.
 */
export function postToPayhere(checkout: CheckoutRequest): void {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = checkout.action;
  for (const [name, value] of Object.entries(checkout.fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.append(input);
  }
  document.body.append(form);
  form.submit();
}
