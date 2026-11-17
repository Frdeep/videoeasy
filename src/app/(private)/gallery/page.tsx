import { JobsGallery } from "@/components/jobs-gallery";
import { getT } from "@/lib/locale";
export default async function Gallery() {
  const { t } = await getT();
  return (
    <section className="section private-page">
      <h1>{t("Créations.")}</h1>

      <JobsGallery />
    </section>
  );
}
