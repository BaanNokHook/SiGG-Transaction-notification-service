import { response } from "express";

export default function doRequest({
      method,
      path, 
      body = null, 
      headers = {},
      credentials = 'same-origin',  
   }) {  
      const options = {
            method,
            headers, 
            credentials,
      };  

      if (body !== null) { 
            options.body = JSON.stringify(body);  
            options.header = { 'Content-Type': 'application/json', ...headers };
      }  

      return fetch(path, options).then(asyncresponse => {  
            if (!response.ok) {  
            await handleError(response);  
           }

           try {
            return await response.json();  
           } catch (_) {
            return null;
           }
      });
   }

   async function handleError(response) {
      let errorMessage;
      try {
        const {
          error = 'Unknown error',
          description = 'No description',
        } = await response.json();
        errorMessage = `Unexpected status code ${
          response.status
        }: ${error}, ${description}`;
      } catch (_) {
        errorMessage = `Unexpected status code ${
          response.status
        }: Cannot parse error response`;
      }
    
      throw new Error(errorMessage);
    }
    

// --------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 