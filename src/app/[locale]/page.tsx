import { Navbar } from "@/components/sections/navbar";
import { Hero } from "@/components/sections/hero";
import { Services } from "@/components/sections/services";
import { HeroBlobs } from "@/components/ui/hero-blobs";
import { WhyUs } from "@/components/sections/why-us";
import { About } from "@/components/sections/about";
import { Principles } from "@/components/sections/principles";
import { Faq } from "@/components/sections/faq";
import { CtaBanner } from "@/components/sections/cta-banner";
import { Contact } from "@/components/sections/contact";
import { Location } from "@/components/sections/location";
import { Footer } from "@/components/sections/footer";
import { WhatsappFloat } from "@/components/ui/whatsapp-float";
import { RoadOverlay } from "@/components/road/road-overlay";

export default function Home() {
  return (
    <>
      <Navbar />
      <RoadOverlay>
        <main className="flex-1">
          <div className="relative overflow-hidden">
            <HeroBlobs />
            <Hero />
            <Services />
          </div>
          <WhyUs />
          <About />
          <Principles />
          <Faq />
          <CtaBanner />
          <Contact />
          <Location />
        </main>
        <Footer />
      </RoadOverlay>
      <WhatsappFloat />
    </>
  );
}
