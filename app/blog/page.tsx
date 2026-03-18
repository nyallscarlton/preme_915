import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Calendar, Clock, Tag } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { blogPosts } from "@/lib/blog-data"
import { getBaseUrl } from "@/lib/config"

const siteUrl = getBaseUrl()

export const metadata: Metadata = {
  title: "DSCR Loan Resources & Investor Guides",
  description:
    "Expert guides on DSCR loans, investment property financing, and rental property strategies. Learn how to qualify, compare loan types, and scale your real estate portfolio.",
  keywords: [
    "DSCR loan guide",
    "investment property financing blog",
    "DSCR loan resources",
    "real estate investor education",
    "rental property loan articles",
  ],
  openGraph: {
    title: "DSCR Loan Resources & Investor Guides | PREME Home Loans",
    description:
      "Expert guides on DSCR loans, investment property financing, and rental property strategies.",
    url: `${siteUrl}/blog`,
    siteName: "PREME Home Loans",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "DSCR Loan Resources & Investor Guides | PREME Home Loans",
    description:
      "Expert guides on DSCR loans, investment property financing, and rental property strategies.",
  },
  alternates: {
    canonical: `${siteUrl}/blog`,
  },
}

export default function BlogIndexPage() {
  const blogListSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "DSCR Loan Resources & Investor Guides",
    description:
      "Expert guides on DSCR loans, investment property financing, and rental property strategies.",
    url: `${siteUrl}/blog`,
    publisher: {
      "@type": "Organization",
      name: "PREME Home Loans",
      url: siteUrl,
    },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: blogPosts.map((post, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${siteUrl}/blog/${post.slug}`,
        name: post.title,
      })),
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogListSchema) }}
      />

      <div className="min-h-screen bg-background text-foreground">
        {/* Navigation */}
        <nav className="border-b border-border/60 backdrop-blur supports-[backdrop-filter]:bg-background/70 sticky top-0 z-30">
          <div className="container mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-3">
              <div className="relative">
                <span className="text-2xl font-bold tracking-wide">
                  PR
                  <span className="relative">
                    E
                    <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-[#997100]"></span>
                  </span>
                  ME
                </span>
              </div>
            </Link>
            <div className="hidden md:flex items-center space-x-6 text-sm font-medium">
              <Link href="/loan-programs" className="hover:text-[#8B6914] transition-colors">
                Programs
              </Link>
              <Link href="/how-it-works" className="hover:text-[#8B6914] transition-colors">
                Process
              </Link>
              <Link href="/blog" className="text-[#997100] transition-colors">
                Resources
              </Link>
              <Link href="/contact" className="hover:text-[#8B6914] transition-colors">
                Contact
              </Link>
              <Button variant="outline" className="border-[#8B6914] text-[#8B6914]" asChild>
                <Link href="/auth">Investor Login</Link>
              </Button>
              <Button className="bg-[#997100] hover:bg-[#b8850a] text-white" asChild>
                <Link href="/start?next=/apply">Start Application</Link>
              </Button>
            </div>
          </div>
        </nav>

        <main>
          {/* Breadcrumb */}
          <div className="container mx-auto px-6 py-4">
            <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
              <ol className="flex items-center space-x-2">
                <li>
                  <Link href="/" className="hover:text-[#997100] transition-colors">
                    Home
                  </Link>
                </li>
                <li>/</li>
                <li className="text-foreground font-medium">Resources</li>
              </ol>
            </nav>
          </div>

          {/* Hero */}
          <section className="bg-gradient-to-b from-black via-[#0b0b0b] to-background text-white">
            <div className="container mx-auto px-6 py-16 lg:py-20">
              <div className="max-w-3xl">
                <Badge className="mb-4 bg-white/10 text-xs uppercase tracking-[0.2em]">
                  Investor Resources
                </Badge>
                <h1 className="text-3xl md:text-5xl font-bold leading-tight">
                  DSCR Loan Guides &amp; <span className="text-[#f5c770]">Investor Education</span>
                </h1>
                <p className="mt-4 text-lg text-gray-300 max-w-2xl">
                  Practical, no-fluff guides on DSCR lending, investment property financing, and
                  scaling your rental portfolio. Written by lenders who fund these deals every day.
                </p>
              </div>
            </div>
          </section>

          {/* Articles Grid */}
          <section className="py-16">
            <div className="container mx-auto px-6">
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {blogPosts.map((post) => (
                  <Card
                    key={post.slug}
                    className="group h-full hover:shadow-lg transition-shadow border-border/60"
                  >
                    <CardContent className="p-6 flex flex-col h-full">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(post.date).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {post.readTime}
                        </span>
                      </div>

                      <h2 className="text-xl font-semibold mb-3 group-hover:text-[#997100] transition-colors">
                        <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                      </h2>

                      <p className="text-muted-foreground text-sm mb-4 flex-grow">
                        {post.excerpt}
                      </p>

                      <div className="flex flex-wrap gap-2 mb-4">
                        {post.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 text-xs bg-[#fff5e1] text-[#7a4a00] px-2 py-1 rounded-full"
                          >
                            <Tag className="h-2.5 w-2.5" />
                            {tag}
                          </span>
                        ))}
                      </div>

                      <Link
                        href={`/blog/${post.slug}`}
                        className="inline-flex items-center text-sm font-medium text-[#8B6914] hover:underline"
                      >
                        Read full guide
                        <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="py-16 bg-muted">
            <div className="container mx-auto px-6 text-center max-w-2xl">
              <h2 className="text-2xl md:text-3xl font-semibold mb-4">
                Ready to put this knowledge to work?
              </h2>
              <p className="text-muted-foreground mb-8">
                Get pre-qualified for a DSCR loan in minutes. No hard credit pull, no tax returns
                required.
              </p>
              <Button
                size="lg"
                className="bg-[#997100] hover:bg-[#b8850a] text-white px-8"
                asChild
              >
                <Link href="/start?next=/apply">
                  Start Your Application
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-border/60 bg-black text-white py-10">
          <div className="container mx-auto px-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between text-sm text-white/70">
            <div>
              &copy; {new Date().getFullYear()} Preme Home Loans. NMLS 2560616. Equal Housing
              Lender.
            </div>
            <div className="flex gap-6">
              <Link href="/privacy" className="hover:text-white">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-white">
                Terms
              </Link>
              <Link href="/contact" className="hover:text-white">
                Contact
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
