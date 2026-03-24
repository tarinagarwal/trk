import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GameInterface from '../GameInterface';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useReadContracts } from 'wagmi';

// Mock wagmi hooks
jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
  useReadContract: jest.fn(),
  useWriteContract: jest.fn(),
  useWaitForTransactionReceipt: jest.fn(),
  useReadContracts: jest.fn(),
}));

// Mock framer-motion (optional, but good practice to avoid animation issues in tests)
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, onClick, disabled }: any) => (
      <div className={className} onClick={onClick} aria-disabled={disabled}>
        {children}
      </div>
    ),
    span: ({ children, className }: any) => <span className={className}>{children}</span>,
    button: ({ children, className, onClick, disabled }: any) => (
      <button className={className} onClick={onClick} disabled={disabled}>
        {children}
      </button>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock config
jest.mock('../../config', () => ({
  TRK_GAME_ADDRESS: '0xMockAddress',
}));

describe('GameInterface Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mocks
    (useAccount as jest.Mock).mockReturnValue({
      address: '0xUser',
      isConnected: true,
      chain: { id: 56 }, // BSC Mainnet
    });

    (useWriteContract as jest.Mock).mockReturnValue({
      writeContract: jest.fn(),
      data: undefined,
      isPending: false,
    });

    (useWaitForTransactionReceipt as jest.Mock).mockReturnValue({
      isLoading: false,
      isSuccess: false,
    });
    
    (useReadContracts as jest.Mock).mockReturnValue({
        data: [],
    });

    (useReadContract as jest.Mock).mockReturnValue({
        data: undefined,
        refetch: jest.fn(),
    });
  });

  it('renders "Please connect your wallet" when not connected', () => {
    (useAccount as jest.Mock).mockReturnValue({ isConnected: false });
    render(<GameInterface />);
    expect(screen.getByText(/Please connect your wallet/i)).toBeInTheDocument();
  });

  it('renders "Wrong Network" when on incorrect chain', () => {
    (useAccount as jest.Mock).mockReturnValue({ 
        isConnected: true, 
        chain: { id: 1 } // Ethereum Mainnet (Wrong)
    });
    render(<GameInterface />);
    expect(screen.getByText(/Wrong Network/i)).toBeInTheDocument();
  });
  
  it('renders "Please register first" when user is not registered', () => {
    // Mock getUserInfo returning registration=false
    // Array definition based on contract: [..., ..., isRegistered(27), ...]
    const mockUserData = new Array(30).fill(null);
    mockUserData[27] = false; // isRegistered

    (useReadContract as jest.Mock).mockReturnValue({
      data: mockUserData,
      refetch: jest.fn(),
    });

    render(<GameInterface />);
    expect(screen.getByText(/Please register first/i)).toBeInTheDocument();
  });

  it('renders Game Interface when registered and allows betting', async () => {
    // Mock getUserInfo returning registered=true, practiceMode=false, walletBalance=10
    const mockUserData = new Array(30).fill(null);
    mockUserData[27] = true; // isRegistered
    mockUserData[28] = false; // isPracticePlayer (User object structure might vary, check contract)
    // Actually Logic in Component: 
    // const isPracticeMode = (userDataArray[28] || false) && !(userDataArray[29] || false);
    // const availableBalance = isPracticeMode ? (userDataArray[4] || 0) : (userDataArray[5] || 0);

    mockUserData[5] = BigInt(10000000000000000000); // 10 USDT
    
    (useReadContract as jest.Mock).mockImplementation(({ functionName }) => {
        if (functionName === 'getUserInfo') return { data: mockUserData, refetch: jest.fn() };
        if (functionName === 'currentCashRoundId') return { data: BigInt(100) };
        return { data: undefined };
    });

    const mockWrite = jest.fn();
    (useWriteContract as jest.Mock).mockReturnValue({
      writeContract: mockWrite,
      data: undefined,
      isPending: false,
    });

    render(<GameInterface />);

    // Check Balance Display
    expect(screen.getByText('10.00')).toBeInTheDocument();
    
    // Select Number '5'
    const numBtn = screen.getAllByText('5', { selector: 'button' })[0]; // The grid button
    fireEvent.click(numBtn);
    
    // Place Bet
    const betBtn = screen.getByText(/PLACE BET/i);
    expect(betBtn).not.toBeDisabled();
    
    fireEvent.click(betBtn);
    
    // Verify Contract Call
    expect(mockWrite).toHaveBeenCalledWith(expect.objectContaining({
        functionName: 'placeBetCash',
        args: [BigInt(5), BigInt('1000000000000000000')] // 1 USDT default
    }));
  });
});
