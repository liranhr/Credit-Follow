import { useLocalSearchParams } from 'expo-router';
import { CategoryForm } from '@/components/CategoryForm';
import { ErrorView, LoadingView } from '@/components/Feedback';
import { useCategories } from '@/hooks/api';
import { he } from '@/i18n/he';
import { describeError } from '@/utils/format';

export default function EditCategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const categories = useCategories(true);

  if (categories.isPending) return <LoadingView />;
  if (categories.isError) {
    return (
      <ErrorView message={describeError(categories.error)} onRetry={() => categories.refetch()} />
    );
  }
  const category = categories.data.find((c) => c.id === id);
  if (!category) return <ErrorView message={he.errors.generic} />;
  return <CategoryForm key={category.id} category={category} />;
}
