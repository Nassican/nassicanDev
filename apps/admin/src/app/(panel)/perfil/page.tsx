import type { Metadata } from "next";
import ProfileModule from "@/components/ProfileModule";
import { listTechnologies } from "@/lib/projects";
import {
  getProfileDraft,
  listCertificates,
  listEducation,
  listExperience,
} from "@/lib/profile";
import {
  saveCertificates,
  saveEducation,
  saveExperience,
  saveProfile,
} from "./actions";

export const metadata: Metadata = { title: "Perfil" };

export default async function PerfilPage() {
  const [profile, experience, education, certificates, technologies] =
    await Promise.all([
      getProfileDraft(),
      listExperience(),
      listEducation(),
      listCertificates(),
      listTechnologies(),
    ]);

  return (
    <ProfileModule
      profile={profile}
      experience={experience}
      education={education}
      certificates={certificates}
      technologies={technologies}
      actions={{ saveProfile, saveExperience, saveEducation, saveCertificates }}
    />
  );
}
