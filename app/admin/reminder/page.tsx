import { redirect } from 'next/navigation';

export default function ReminderRedirect() {
  redirect('/admin/meridian/products/busyreminder');
}
