import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { phone, cpf, email } = await req.json();
    
    console.log('Checking duplicates for:', { 
      phone: phone ? 'provided' : 'null', 
      cpf: cpf ? 'provided' : 'null',
      email: email ? 'provided' : 'null'
    });

    const duplicates = {
      phone: false,
      cpf: false,
      email: false
    };

    // Check phone duplicate
    if (phone && phone.trim()) {
      const { data: phoneData, error: phoneError } = await supabaseClient
        .from('poupeja_users')
        .select('id')
        .eq('phone', phone.trim())
        .limit(1);
      
      if (phoneError) {
        console.error('Error checking phone duplicate:', phoneError);
      } else {
        duplicates.phone = phoneData && phoneData.length > 0;
      }
    }

    // Check CPF duplicate
    if (cpf && cpf.trim()) {
      const { data: cpfData, error: cpfError } = await supabaseClient
        .from('poupeja_users')
        .select('id')
        .eq('cpf', cpf.trim())
        .limit(1);
      
      if (cpfError) {
        console.error('Error checking CPF duplicate:', cpfError);
      } else {
        duplicates.cpf = cpfData && cpfData.length > 0;
      }
    }

    // Check email duplicate in auth.users
    if (email && email.trim()) {
      const { data: authData, error: authError } = await supabaseClient.auth.admin.listUsers();
      
      if (authError) {
        console.error('Error checking email duplicate:', authError);
      } else {
        const emailExists = authData.users.some(user => user.email === email.trim());
        duplicates.email = emailExists;
      }
    }

    console.log('Duplicate check results:', duplicates);

    return new Response(JSON.stringify({ duplicates }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in check-duplicate-data function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', duplicates: { phone: false, cpf: false, email: false } }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});