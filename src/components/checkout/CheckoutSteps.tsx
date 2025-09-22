import React from 'react';

interface CheckoutStepsProps {
  currentStep: number;
}

export const CheckoutSteps: React.FC<CheckoutStepsProps> = ({ currentStep }) => {
  const steps = [
    { number: 1, title: 'Dados do Cartão', description: 'Informações de pagamento' },
    { number: 2, title: 'Confirmação', description: 'Revisar pedido' },
    { number: 3, title: 'Processamento', description: 'Aguardando pagamento' },
    { number: 4, title: 'Concluído', description: 'Assinatura ativada' }
  ];

  const getStepStatus = (stepNumber: number) => {
    if (stepNumber < currentStep) return 'completed';
    if (stepNumber === currentStep) return 'current';
    return 'upcoming';
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center">
        {steps.map((step, index) => (
          <React.Fragment key={step.number}>
            <div className="flex flex-col items-center">
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
                  transition-all duration-200
                  ${getStepStatus(step.number) === 'completed' 
                    ? 'bg-green-500 text-white' 
                    : getStepStatus(step.number) === 'current'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                  }
                `}
              >
                {getStepStatus(step.number) === 'completed' ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  step.number
                )}
              </div>
              
              <div className="mt-2 text-center">
                <div
                  className={`
                    text-sm font-medium
                    ${getStepStatus(step.number) === 'current' 
                      ? 'text-primary' 
                      : getStepStatus(step.number) === 'completed'
                      ? 'text-green-600'
                      : 'text-muted-foreground'
                    }
                  `}
                >
                  {step.title}
                </div>
                <div className="text-xs text-muted-foreground hidden sm:block">
                  {step.description}
                </div>
              </div>
            </div>
            
            {index < steps.length - 1 && (
              <div
                className={`
                  flex-1 h-px mx-4 transition-all duration-200
                  ${step.number < currentStep 
                    ? 'bg-green-500' 
                    : 'bg-muted'
                  }
                `}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};