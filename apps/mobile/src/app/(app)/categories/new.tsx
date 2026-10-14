import { useLocalSearchParams } from 'expo-router';
import { CategoryForm } from '@/components/CategoryForm';

/** New variable budget, or a new fixed expense with `?kind=fixed`. */
export default function NewCategoryScreen() {
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  return <CategoryForm kind={kind === 'fixed' ? 'fixed' : 'variable'} />;
}
