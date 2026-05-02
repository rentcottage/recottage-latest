import { useState } from 'react';

interface CancellationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CancellationModal({ isOpen, onClose }: CancellationModalProps) {
  if (!isOpen) return null;

  const policies = [
    {
      id: 'flexible',
      name: 'Flexible',
      description: 'Guests can cancel 2 or more days before check-in and receive a full refund for online payments.',
      refund: 'For online payments, if the booking is canceled 2 or more days before the check-in date, the guest will receive a full refund.',
      popular: true
    },
    {
      id: 'moderate',
      name: 'Moderate',
      description: 'Guests can cancel up to 2 days before check-in and receive a 90% refund for online payments.',
      refund: 'For online payments, if the booking is canceled within 2 days before check-in, the guest will receive a 90% refund.',
      popular: false
    },
    {
      id: 'strict',
      name: 'Strict',
      description: 'If the booking is canceled within 24 hours before check-in, the guest will receive an 80% refund for online payments.',
      refund: 'For online payments, if the booking is canceled within 24 hours before check-in, the guest will receive an 80% refund.',
      popular: false
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
          <h2 className="text-base sm:text-xl md:text-2xl font-bold text-gray-900">Cancellation Information</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            <i className="ri-close-line text-lg sm:text-xl"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
          <div className="mb-4 sm:mb-6">
            <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
              Our cancellation policies are designed to provide flexibility while protecting both guests and hosts. Each property may have different cancellation terms based on the host's preferences.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
              <div className="flex items-start">
                <div className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center mr-2 sm:mr-3 mt-0.5 flex-shrink-0">
                  <i className="ri-information-line text-blue-500 text-sm sm:text-base"></i>
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900 text-xs sm:text-sm mb-1">Important to Know</h3>
                  <ul className="text-blue-800 text-xs space-y-1">
                    <li>• Cancellation policies are clearly displayed on each property listing</li>
                    <li>• More flexible policies may attract more bookings</li>
                    <li>• Stricter policies provide more protection against last-minute cancellations</li>
                    <li>• Hosts can adjust their policy based on seasonal demand</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Policy Information */}
          <div className="space-y-3 sm:space-y-4 mb-5 sm:mb-8">
            <h3 className="text-sm sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Available Cancellation Policies</h3>
            {policies.map((policy) => (
              <div
                key={policy.id}
                className="border border-gray-200 rounded-xl p-3 sm:p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-1.5 sm:mb-2 flex-wrap gap-1.5">
                      <h3 className="text-sm sm:text-lg font-semibold text-gray-900">
                        {policy.name}
                      </h3>
                      {policy.popular && (
                        <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap">
                          Most Popular
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3">{policy.description}</p>
                    <div className="bg-gray-50 rounded-lg p-2 sm:p-3">
                      <h4 className="font-medium text-gray-900 text-xs sm:text-sm mb-1">Refund Policy:</h4>
                      <p className="text-xs text-gray-600">{policy.refund}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Additional Information */}
          <div className="bg-gray-50 rounded-lg p-3 sm:p-6 mb-4 sm:mb-6">
            <h3 className="text-xs sm:text-base font-semibold text-gray-900 mb-3 sm:mb-4">Additional Cancellation Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
              <div>
                <h4 className="font-medium text-gray-900 text-xs sm:text-sm mb-1.5 sm:mb-2">Host Cancellations</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• If a host cancels, you receive a full refund</li>
                  <li>• Repeated cancellations can affect your listing status</li>
                  <li>• Emergency cancellations are handled case-by-case</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 text-xs sm:text-sm mb-1.5 sm:mb-2">Force Majeure Events</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• Natural disasters and government restrictions</li>
                  <li>• Special cancellation policies may apply</li>
                  <li>• Both hosts and guests are protected</li>
                </ul>
              </div>
            </div>
          </div>

          {/* How to Cancel */}
          <div className="bg-red-50 rounded-lg p-3 sm:p-6 mb-4 sm:mb-6">
            <h3 className="text-xs sm:text-base font-semibold text-gray-900 mb-3 sm:mb-4">How to Cancel Your Booking</h3>
            <div className="space-y-2 sm:space-y-3">
              {[
                { step: '1', title: 'Go to Your Trips', desc: 'Log in to your account and navigate to "Your Trips" section' },
                { step: '2', title: 'Select Your Booking', desc: 'Find the booking you want to cancel and click on it' },
                { step: '3', title: 'Click Cancel', desc: 'Review the cancellation policy and confirm your cancellation' },
                { step: '4', title: 'Receive Confirmation', desc: "You'll receive an email confirmation and refund details" },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex items-start">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 bg-red-100 rounded-full flex items-center justify-center mr-2 sm:mr-3 mt-0.5 flex-shrink-0">
                    <span className="text-xs font-semibold text-red-600">{step}</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 text-xs sm:text-sm">{title}</h4>
                    <p className="text-xs text-gray-600">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* FAQ Section */}
          <div className="mb-4 sm:mb-6">
            <h3 className="text-xs sm:text-base font-semibold text-gray-900 mb-3 sm:mb-4">Frequently Asked Questions</h3>
            <div className="space-y-2 sm:space-y-4">
              {[
                {
                  q: 'When will I receive my refund?',
                  a: "Refunds are processed automatically based on the property's cancellation policy. You'll receive refunds to your original payment method within 5-10 business days."
                },
                {
                  q: 'Can I modify my booking instead of cancelling?',
                  a: 'Yes, you can request to modify your booking dates or guest count. Contact the host directly or reach out to our support team for assistance with modifications.'
                },
                {
                  q: "What if there's an emergency?",
                  a: "We understand that emergencies happen. Contact our support team immediately with documentation, and we'll review your situation for possible exceptions to the standard policy."
                },
                {
                  q: 'What happens if the host cancels?',
                  a: "If a host cancels your booking, you'll receive a full refund automatically. We'll also help you find alternative accommodations and may provide additional compensation."
                },
              ].map(({ q, a }) => (
                <div key={q} className="border border-gray-200 rounded-lg p-3 sm:p-4">
                  <h4 className="font-medium text-gray-900 text-xs sm:text-sm mb-1 sm:mb-2">{q}</h4>
                  <p className="text-xs text-gray-600">{a}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-center">
            <button
              onClick={onClose}
              className="px-6 sm:px-8 py-2.5 sm:py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 cursor-pointer whitespace-nowrap font-medium text-sm"
            >
              Got It
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
