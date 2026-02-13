//package com.scottfamily.scottfamily.service;
//
//import com.scottfamily.scottfamily.dto.DTOs;
//import lombok.RequiredArgsConstructor;
//import org.springframework.mail.SimpleMailMessage;
//import org.springframework.mail.javamail.JavaMailSender;
//import org.springframework.stereotype.Service;
//
//import java.util.UUID;
//
//@Service
//@RequiredArgsConstructor
//public class PaymentService {
////    private final SquareClient square;          // configured elsewhere
//    private final JavaMailSender mailSender;    // spring‑boot‑starter‑mail
//
//    public void charge(DTOs.PaymentRequest dto) {
//        // Create Square payment (simplified)
//        Money money = new Money.Builder()
//                .amount(dto.amount())
//                .currency(dto.currency())
//                .build();
//        CreatePaymentRequest body = new CreatePaymentRequest.Builder(dto.sourceId(), UUID.randomUUID().toString())
//                .amountMoney(money)
//                .locationId("YOUR_LOCATION_ID")
//                .autocomplete(true)
//                .build();
//        square.getPaymentsApi().createPayment(body);
//
//        // Send confirmation email
//        var msg = new SimpleMailMessage();
//        msg.setTo(dto.email());
//        msg.setSubject("Payment Confirmation");
//        msg.setText("Thank you! We received $" + (dto.amount() / 100.0) + " USD.");
//        mailSender.send(msg);
//    }
//}