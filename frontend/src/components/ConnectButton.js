import { ConnectButton } from '@rainbow-me/rainbowkit';
import './style/Components.css';

export function ConnectButtonComp() {

  return (
      <div className='connect-btn-container'>
        <div className='connect-btn'><ConnectButton /></div>
      </div>
  );
}