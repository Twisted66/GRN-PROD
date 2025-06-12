import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer-core';
import { 
  createAuthenticatedClient, 
  extractAuthToken, 
  authenticateUser, 
  checkProjectAccess,
  responses 
} from '../../src/lib/auth-utils';
import { reportGenerationSchema, validateInput } from '../../src/lib/validation-schemas';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract and validate auth token
    const authToken = extractAuthToken(req);
    if (!authToken) {
      return res.status(401).json(responses.unauthorized().body);
    }

    // Create authenticated Supabase client
    const supabase = createAuthenticatedClient(authToken);
    
    // Authenticate user
    const { success: authSuccess, user, error: authError } = await authenticateUser(supabase);
    if (!authSuccess || !user) {
      return res.status(401).json(responses.unauthorized(authError).body);
    }

    // Validate input data
    const validation = validateInput(reportGenerationSchema, req.body);
    if (!validation.success) {
      return res.status(400).json(responses.badRequest('Invalid input data', validation.errors).body);
    }

    const { projectId, startDate, endDate } = validation.data;

    // SECURITY: Check if user has access to this project
    const hasAccess = await checkProjectAccess(supabase, user.id, projectId);
    if (!hasAccess) {
      return res.status(403).json(responses.forbidden('You do not have access to this project').body);
    }

    // Get project info first
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('name')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return res.status(404).json(responses.notFound('Project not found').body);
    }

    // Complex query to get rental data with calculations (using authenticated client respects RLS)
    const { data: rentalData, error } = await supabase
      .from('dn_items')
      .select(`
        *,
        delivery_notes!inner(delivery_date, purchase_order_id),
        po_items!inner(item_name, unit_price),
        po_items.purchase_orders!inner(po_number, project_id),
        po_items.purchase_orders.vendors!inner(name)
      `)
      .eq('po_items.purchase_orders.project_id', projectId)
      .gte('delivery_notes.delivery_date', startDate)
      .lte('delivery_notes.delivery_date', endDate);

    if (error) {
      console.error('Data fetch error:', error);
      return res.status(500).json(responses.serverError('Failed to fetch rental data').body);
    }

    if (!rentalData || rentalData.length === 0) {
      return res.status(404).json(responses.notFound('No rental data found for the specified period').body);
    }

    // Calculate rental days and amounts
    const processedData = rentalData.map(item => {
      const deliveryDate = new Date(item.delivery_notes.delivery_date);
      const returnDate = item.returned_at ? new Date(item.returned_at) : new Date();
      const totalDays = Math.ceil((returnDate.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24));
      
      const ongoingQuantity = item.delivered_quantity - item.returned_quantity;
      const returnedQuantity = item.returned_quantity;
      
      const ongoingDays = item.status !== 'fully_returned' ? totalDays : 0;
      const returnedDays = item.status !== 'delivered' ? totalDays : 0;
      
      const amountToPay = (ongoingQuantity * ongoingDays + returnedQuantity * returnedDays) * (item.daily_rate || 0);

      return {
        ...item,
        totalDays,
        ongoingQuantity,
        returnedQuantity,
        ongoingDays,
        returnedDays,
        amountToPay
      };
    });

    // Generate HTML report
    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rental Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .header { text-align: center; margin-bottom: 20px; }
          .summary { margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Equipment Rental Report</h1>
          <h2>Project: ${project.name}</h2>
          <p>Period: ${startDate} to ${endDate}</p>
          <p>Generated: ${new Date().toLocaleDateString()}</p>
        </div>
        
        <div class="summary">
          <h3>Summary</h3>
          <p>Total Items: ${processedData.length}</p>
          <p>Total Amount: $${processedData.reduce((sum, item) => sum + item.amountToPay, 0).toFixed(2)}</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>PO Number</th>
              <th>Item Name</th>
              <th>Vendor</th>
              <th>Delivered Qty</th>
              <th>Returned Qty</th>
              <th>Ongoing Qty</th>
              <th>Days</th>
              <th>Daily Rate</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${processedData.map(item => `
              <tr>
                <td>${item.po_items.purchase_orders.po_number}</td>
                <td>${item.po_items.item_name}</td>
                <td>${item.po_items.purchase_orders.vendors.name}</td>
                <td>${item.delivered_quantity}</td>
                <td>${item.returned_quantity}</td>
                <td>${item.ongoingQuantity}</td>
                <td>${item.totalDays}</td>
                <td>$${(item.daily_rate || 0).toFixed(2)}</td>
                <td>$${item.amountToPay.toFixed(2)}</td>
                <td>${item.status}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    // Generate PDF using Puppeteer with better error handling
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      });
      
      const page = await browser.newPage();
      
      // Set viewport and wait for content to load
      await page.setViewport({ width: 1200, height: 800 });
      await page.setContent(htmlTemplate, { waitUntil: 'networkidle0' });
      
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' },
        displayHeaderFooter: true,
        footerTemplate: `<div style="font-size: 10px; margin: 0 auto;">Generated on ${new Date().toLocaleDateString()} | Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`
      });
      
      await browser.close();

      const filename = `rental-report-${project.name.replace(/[^a-zA-Z0-9]/g, '-')}-${startDate}-${endDate}.pdf`;
      
      return res.status(200).json({
        ...responses.pdf(pdf, filename),
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': pdf.length.toString()
        }
      });

    } catch (pdfError) {
      console.error('PDF generation error:', pdfError);
      if (browser) {
        await browser.close();
      }
      return res.status(500).json(responses.serverError('PDF generation failed').body);
    }

  } catch (error) {
    console.error('Error generating report:', error);
    return res.status(500).json(responses.serverError('Report generation failed').body);
  }
}