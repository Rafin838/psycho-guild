import React from 'react';

export const BackgroundEffects: React.FC = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 bg-[#05070a]">
      {/* Sleek Interface Ambient Deep Radial Gradients */}
      <div 
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle at 0% 0%, #1e1b4b 0%, transparent 50%), radial-gradient(circle at 100% 100%, #1e1b4b 0%, transparent 50%)`,
        }}
      />

      {/* Subtle soft glowing accents */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[130px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-[130px]" />
    </div>
  );
};

