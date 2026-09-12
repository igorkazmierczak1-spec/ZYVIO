import { ArrowLeft, Compass, Swords } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div className="not-found-page">
      <div className="not-found-mark"><Swords size={30} /></div>
      <span className="eyebrow">ZYVIO / Out of bounds</span>
      <h1>This arena does not exist.</h1>
      <p>The page you are looking for moved, ended, or never entered the bracket.</p>
      <Link href="/" className="button button-mint" data-testid="link-not-found-home"><ArrowLeft size={16} /> Back to home <Compass size={16} /></Link>
    </div>
  );
}
