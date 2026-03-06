import type { Metadata } from "next"
import AboutClient from "./AboutClient"

export const metadata: Metadata = {
  title: "About Us",
  description:
    "PREME Home Loans is built by investors, for investors. We provide DSCR loans, fix & flip financing, and investment property lending with fast closings and no tax return requirements.",
}

export default function AboutPage() {
  return <AboutClient />
}
