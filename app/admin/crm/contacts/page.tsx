import { redirect } from 'next/navigation';

export default function CrmContactsRedirect() {
  redirect('/admin/crm/companies');
}
