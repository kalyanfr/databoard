import SectionShell from "@/components/landing/SectionShell";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FAQS = [
  {
    q: "How do goals and funnels work?",
    a: "Mark a page or a one-line event (signup, checkout) as a goal. Put goals in order and the funnel shows where visitors drop off. No SQL.",
  },
  {
    q: "Who is this for?",
    a: "Founders, indie makers and small teams who want to see which traffic turns into customers, without hiring someone to run Google Analytics.",
  },
  {
    q: "How much does it cost?",
    a: "Solo for one site from $9 a month, Plus for unlimited sites and your team from $19. Every feature on both, free for 14 days.",
  },
  {
    q: "Do I need a cookie banner?",
    a: "No. Data Board sets no cookies and stores no personal data by default. Revenue attribution adds one optional first-party cookie, only if you switch it on.",
  },
  {
    q: "Will it work with my stack?",
    a: "Anywhere you can add a script tag: Next.js, WordPress, Webflow, Shopify, Framer or plain HTML. Under 3 KB gzipped, so it never slows your site.",
  },
  {
    q: "Where is my data stored?",
    a: "In your Data Board workspace, with no IPs, cookies or fingerprints stored. You can delete a site and all of its data at any time.",
  },
  {
    q: "What does it track out of the box?",
    a: "Visitors, pageviews, sources, channels, campaigns, pages, countries, devices, bounce rate and visit duration. Live and over time, plus custom events.",
  },
  {
    q: "Is this a Google Analytics replacement?",
    a: "For most startups and indie products, yes. Keep GA only if you need ad attribution across dozens of channels; open Data Board to see what pays.",
  },
];

export default function Faq() {
  return (
    <SectionShell
      id="faq"
      containerClassName="max-w-3xl"
      title="Frequently asked questions."
      description="The questions customers ask before wiring up their first site."
    >
      <Accordion type="single" collapsible>
        {FAQS.map((faq, index) => (
          <AccordionItem key={faq.q} value={`item-${index}`} className="border-border">
            <AccordionTrigger className="text-left text-base font-medium hover:no-underline">{faq.q}</AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{faq.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </SectionShell>
  );
}