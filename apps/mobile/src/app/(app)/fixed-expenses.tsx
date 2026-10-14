import { CategoryManager } from '@/components/CategoryManager';

/** "עריכת הוצאות קבועות": create, edit, archive and restore fixed monthly expenses. */
export default function FixedExpensesScreen() {
  return <CategoryManager kind="fixed" />;
}
