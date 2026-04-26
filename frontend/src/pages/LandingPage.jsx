import HeroSection from '../features/landing/HeroSection'
import FeaturesSection from '../features/landing/FeaturesSection'
import IdePreviewSection from '../features/landing/IdePreviewSection'
import WorkflowSection from '../features/landing/WorkflowSection'
import CollabSection from '../features/landing/CollabSection'
import TrustSection from '../features/landing/TrustSection'
import DevResourcesSection from '../features/landing/DevResourcesSection'
import CtaSection from '../features/landing/CtaSection'

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <IdePreviewSection />
      <WorkflowSection />
      <CollabSection />
      <TrustSection />
      <DevResourcesSection />
      <CtaSection />
    </>
  )
}
