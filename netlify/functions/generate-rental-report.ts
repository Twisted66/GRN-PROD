import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer-core';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { projectId, startDate, endDate } = req.body;

    // Complex query to get rental data with calculations
    const { data: rentalData, error } = await supabase
      .from('dn_items')
      .select(`
        *,
        delivery_notes!inner(delivery_date),
        po_items!inner(item_name, unit_price),
        po_items.purchase_orders!inner(po_number, project_id),
        po_items.purchase_orders.projects!inner(name),
        po_items.purchase_orders.vendors!inner(name)
      `)
      .eq('po_items.purchase_orders.project_id', projectId)
      .gte('delivery_notes.delivery_date', startDate)
      .lte('delivery_notes.delivery_date', endDate);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch data' });
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
          <p>Period: ${startDate} to ${endDate}</p>
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

    // Generate PDF using Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setContent(htmlTemplate);
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' }
    });
    
    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=rental-report.pdf');
    res.send(pdf);

  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: 'Report generation failed' });
  }
}