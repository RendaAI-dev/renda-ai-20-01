import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

// Cartões de teste válidos do Asaas
const VALID_TEST_CARDS = {
  // Cartões que são aprovados automaticamente no sandbox
  approved: [
    {
      number: '5162306219378829',
      brand: 'Mastercard',
      description: 'Cartão aprovado automaticamente'
    },
    {
      number: '5448280000000007',
      brand: 'Mastercard',
      description: 'Cartão aprovado automaticamente'
    },
    {
      number: '4111111111111111',
      brand: 'Visa',
      description: 'Cartão aprovado automaticamente'
    },
    {
      number: '4000000000000010',
      brand: 'Visa',
      description: 'Cartão aprovado automaticamente'
    }
  ],
  // Cartões que são rejeitados automaticamente (para testes)
  declined: [
    {
      number: '4000000000000002',
      brand: 'Visa',
      description: 'Cartão rejeitado automaticamente'
    },
    {
      number: '5555555555554444',
      brand: 'Mastercard',
      description: 'Cartão rejeitado automaticamente'
    }
  ]
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cardNumber, returnType = 'validation' } = await req.json();

    console.log('[VALIDATE-TEST-CARDS] Validando cartão:', cardNumber?.slice(0, 6) + '****');

    // Se é uma consulta para listar cartões válidos
    if (returnType === 'list') {
      return new Response(JSON.stringify({
        success: true,
        testCards: VALID_TEST_CARDS
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!cardNumber) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Número do cartão é obrigatório'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Remover espaços e formatação
    const cleanCardNumber = cardNumber.replace(/\s+/g, '');

    // Verificar se é um cartão de teste válido
    const approvedCard = VALID_TEST_CARDS.approved.find(card => 
      card.number === cleanCardNumber
    );

    const declinedCard = VALID_TEST_CARDS.declined.find(card => 
      card.number === cleanCardNumber
    );

    let validation = {
      isTestCard: false,
      isValidTestCard: false,
      expectedResult: null as string | null,
      brand: null as string | null,
      recommendation: ''
    };

    if (approvedCard) {
      validation = {
        isTestCard: true,
        isValidTestCard: true,
        expectedResult: 'approved',
        brand: approvedCard.brand,
        recommendation: 'Este cartão será aprovado automaticamente no sandbox do Asaas'
      };
    } else if (declinedCard) {
      validation = {
        isTestCard: true,
        isValidTestCard: true,
        expectedResult: 'declined',
        brand: declinedCard.brand,
        recommendation: 'Este cartão será rejeitado automaticamente no sandbox do Asaas'
      };
    } else {
      // Verificar se é um cartão de teste (sandbox) genérico
      const isLikelyTestCard = cleanCardNumber.startsWith('4111') || 
                              cleanCardNumber.startsWith('5555') ||
                              cleanCardNumber.startsWith('4000') ||
                              cleanCardNumber.startsWith('5448');

      if (isLikelyTestCard) {
        validation = {
          isTestCard: true,
          isValidTestCard: false,
          expectedResult: 'pending',
          brand: getBrandFromNumber(cleanCardNumber),
          recommendation: 'Este cartão pode ficar em PENDING no sandbox. Recomendamos usar um dos cartões aprovados automaticamente.'
        };
      } else {
        validation = {
          isTestCard: false,
          isValidTestCard: false,
          expectedResult: 'unknown',
          brand: getBrandFromNumber(cleanCardNumber),
          recommendation: 'Cartão real - não deve ser usado no ambiente sandbox'
        };
      }
    }

    console.log('[VALIDATE-TEST-CARDS] Resultado da validação:', validation);

    return new Response(JSON.stringify({
      success: true,
      cardNumber: cleanCardNumber.slice(0, 6) + '****' + cleanCardNumber.slice(-4),
      validation,
      suggestedCards: validation.isValidTestCard ? null : VALID_TEST_CARDS.approved.slice(0, 2)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[VALIDATE-TEST-CARDS] Erro:', error.message);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Detectar bandeira do cartão baseado no número
function getBrandFromNumber(cardNumber: string): string {
  const firstDigit = cardNumber.charAt(0);
  const firstTwoDigits = cardNumber.substring(0, 2);
  const firstFourDigits = cardNumber.substring(0, 4);

  // Visa
  if (firstDigit === '4') {
    return 'Visa';
  }
  
  // Mastercard
  if (firstTwoDigits >= '51' && firstTwoDigits <= '55') {
    return 'Mastercard';
  }
  if (firstTwoDigits >= '22' && firstTwoDigits <= '27') {
    return 'Mastercard';
  }
  
  // American Express
  if (firstTwoDigits === '34' || firstTwoDigits === '37') {
    return 'American Express';
  }
  
  // Discover
  if (firstFourDigits === '6011' || firstTwoDigits === '65') {
    return 'Discover';
  }
  
  return 'Unknown';
}