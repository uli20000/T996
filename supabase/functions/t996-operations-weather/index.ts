import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {createWeatherHandler} from './handler.mjs';
Deno.serve(createWeatherHandler({createClient,env:(key:string)=>Deno.env.get(key)}));
