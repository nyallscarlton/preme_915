import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight, Calendar, Clock, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { blogPosts, getBlogPost, getAllSlugs } from "@/lib/blog-data"
import { getBaseUrl } from "@/lib/config"

const siteUrl = getBaseUrl()

interface PageProps {
  params: { slug: string }
}

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }))
}

export function generateMetadata({ params }: PageProps): Metadata {
  const post = getBlogPost(params.slug)
  if (!post) return {}

  return {
    title: post.title,
    description: post.metaDescription,
    keywords: post.keywords,
    openGraph: {
      title: `${post.title} | PREME Home Loans`,
      description: post.metaDescription,
      url: `${siteUrl}/blog/${post.slug}`,
      siteName: "PREME Home Loans",
      type: "article",
      locale: "en_US",
      publishedTime: post.date,
      authors: ["PREME Home Loans"],
      tags: post.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: `${post.title} | PREME Home Loans`,
      description: post.metaDescription,
    },
    alternates: {
      canonical: `${siteUrl}/blog/${post.slug}`,
    },
  }
}

function renderMarkdown(content: string): string {
  // Convert markdown to HTML
  let html = content

  // Convert headings
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-xl font-semibold mt-8 mb-3 text-foreground">$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-2xl font-semibold mt-10 mb-4 text-foreground">$1</h2>')

  // Convert bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")

  // Convert italic
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>")

  // Convert links - internal
  html = html.replace(
    /\[([^\]]+)\]\((\/([\w\-/]+))\)/g,
    '<a href="$2" class="text-[#997100] underline underline-offset-2 hover:text-[#b8850a]">$1</a>'
  )

  // Convert links - external / tel / mailto
  html = html.replace(
    /\[([^\]]+)\]\(((?:https?:|tel:|mailto:)[^\)]+)\)/g,
    '<a href="$2" class="text-[#997100] underline underline-offset-2 hover:text-[#b8850a]">$1</a>'
  )

  // Convert unordered list items
  html = html.replace(
    /^- (.+)$/gm,
    '<li class="flex items-start gap-2 ml-4"><span class="text-[#997100] mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-[#997100] inline-block"></span><span>$1</span></li>'
  )

  // Wrap consecutive list items
  html = html.replace(
    /(<li[\s\S]*?<\/li>\n?)+/g,
    '<ul class="space-y-2 my-4">$&</ul>'
  )

  // Convert ordered list items
  html = html.replace(
    /^(\d+)\. (.+)$/gm,
    '<li class="ml-6 list-decimal"><span>$2</span></li>'
  )

  // Wrap consecutive ordered list items
  html = html.replace(
    /(<li class="ml-6 list-decimal">[\s\S]*?<\/li>\n?)+/g,
    '<ol class="space-y-2 my-4 list-decimal">$&</ol>'
  )

  // Convert horizontal rules
  html = html.replace(/^---$/gm, '<hr class="my-10 border-border/60" />')

  // Convert paragraphs (lines that aren't already HTML)
  const lines = html.split("\n")
  const result: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (
      trimmed === "" ||
      trimmed.startsWith("<h") ||
      trimmed.startsWith("<ul") ||
      trimmed.startsWith("</ul") ||
      trimmed.startsWith("<ol") ||
      trimmed.startsWith("</ol") ||
      trimmed.startsWith("<li") ||
      trimmed.startsWith("<hr") ||
      trimmed.startsWith("<a")
    ) {
      result.push(line)
    } else {
      result.push(`<p class="text-muted-foreground leading-relaxed mb-4">${trimmed}</p>`)
    }
  }

  return result.join("\n")
}

export default function BlogPostPage({ params }: PageProps) {
  const post = getBlogPost(params.slug)
  if (!post) notFound()

  const currentIndex = blogPosts.findIndex((p) => p.slug === params.slug)
  const relatedPosts = blogPosts.filter((p) => p.slug !== params.slug).slice(0, 3)

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.metaDescription,
    datePublished: post.date,
    dateModified: post.date,
    author: {
      "@type": "Organization",
      name: "PREME Home Loans",
      url: siteUrl,
    },
    publisher: {
      "@type": "Organization",
      name: "PREME Home Loans",
      url: siteUrl,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${siteUrl}/blog/${post.slug}`,
    },
    keywords: post.keywords.join(", "),
  }

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: siteUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Resources",
        item: `${siteUrl}/blog`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: post.title,
        item: `${siteUrl}/blog/${post.slug}`,
      },
    ],
  }

  const contentHtml = renderMarkdown(post.content)

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
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
                <li>
                  <Link href="/blog" className="hover:text-[#997100] transition-colors">
                    Resources
                  </Link>
                </li>
                <li>/</li>
                <li className="text-foreground font-medium truncate max-w-[250px]">
                  {post.title}
                </li>
              </ol>
            </nav>
          </div>

          {/* Article Header */}
          <section className="border-b border-border/60">
            <div className="container mx-auto px-6 py-10 max-w-4xl">
              <Link
                href="/blog"
                className="inline-flex items-center text-sm text-muted-foreground hover:text-[#997100] mb-6 transition-colors"
              >
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                All Resources
              </Link>

              <div className="flex flex-wrap gap-2 mb-4">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 text-xs bg-[#fff5e1] text-[#7a4a00] px-2 py-1 rounded-full"
                  >
                    <Tag className="h-2.5 w-2.5" />
                    {tag}
                  </span>
                ))}
              </div>

              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-4">
                {post.title}
              </h1>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(post.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {post.readTime}
                </span>
              </div>
            </div>
          </section>

          {/* Article Content */}
          <article className="py-12">
            <div
              className="container mx-auto px-6 max-w-4xl prose-custom"
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
          </article>

          {/* Related Articles */}
          <section className="py-16 bg-muted border-t border-border/60">
            <div className="container mx-auto px-6">
              <h2 className="text-2xl font-semibold mb-8">Continue Reading</h2>
              <div className="grid gap-6 md:grid-cols-3">
                {relatedPosts.map((related) => (
                  <Link
                    key={related.slug}
                    href={`/blog/${related.slug}`}
                    className="group rounded-xl border border-border/60 bg-white p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <Calendar className="h-3 w-3" />
                      {new Date(related.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      <span className="mx-1">|</span>
                      <Clock className="h-3 w-3" />
                      {related.readTime}
                    </div>
                    <h3 className="font-semibold group-hover:text-[#997100] transition-colors mb-2">
                      {related.title}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">{related.excerpt}</p>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="py-16">
            <div className="container mx-auto px-6">
              <div className="mx-auto max-w-3xl rounded-3xl bg-gradient-to-br from-[#0b0b0b] to-[#1a1a1a] p-10 text-center text-white shadow-2xl">
                <h2 className="text-2xl md:text-3xl font-bold mb-3">
                  Ready to apply what you&apos;ve learned?
                </h2>
                <p className="text-white/70 mb-8 max-w-xl mx-auto">
                  Get pre-qualified for a DSCR loan in minutes. No hard credit pull, no tax returns,
                  same-day term sheet.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    size="lg"
                    className="bg-[#997100] hover:bg-[#b8850a] text-white px-8"
                    asChild
                  >
                    <Link href="/start?next=/apply">
                      Start My Application
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-white/30 text-white hover:bg-white/10"
                    asChild
                  >
                    <Link href="tel:+14709425787">(470) 942-5787</Link>
                  </Button>
                </div>
              </div>
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
