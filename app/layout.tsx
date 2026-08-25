import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Crusader — Child Safety Intelligence',description:'Explainable grooming-risk detection and evidence dossier demo.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
