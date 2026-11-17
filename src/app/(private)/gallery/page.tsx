import { JobsGallery } from "@/components/jobs-gallery";
export default function Gallery() {
  return (
    <section className="section private-page">
      <h1>Mes créations</h1>
      <p>Vos vidéos, vos images et vos tâches en cours.</p>
      <JobsGallery />
    </section>
  );
}
