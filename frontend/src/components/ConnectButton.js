import { useConnect, useDisconnect } from 'wagmi';
import './style/Components.css';

export function ConnectButton() {
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const handleConnect = () => {
    disconnect();
    setTimeout(() => {
        const targetConnector = connectors.find(c => c.id === 'io.rabby') 
                             || connectors.find(c => c.id === 'injected' || c.type === 'injected') 
                             || connectors[0];

        if (targetConnector) {
            connect({ connector: targetConnector });
        }
    }, 50);
  };

  return (
      <div className='connect-btn-container'>
        <div className='connect-btn' onClick={handleConnect}></div>
      </div>
  );
}