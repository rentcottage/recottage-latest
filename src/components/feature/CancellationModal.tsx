import { useTranslation } from '@lib/i18n';

interface CancellationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CancellationModal({ isOpen, onClose }: CancellationModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const policies = [
    {
      id: 'flexible',
      name: t('cancellation.flexible'),
      description: t('home.helpModal.cancellationStep1Desc'),
      refund: t('cancellation.flexibleRefund'),
      popular: true
    },
    {
      id: 'moderate',
      name: t('cancellation.moderate'),
      description: t('home.helpModal.cancellationStep2Desc'),
      refund: t('cancellation.moderateRefund'),
      popular: false
    },
    {
      id: 'strict',
      name: t('cancellation.strict'),
      description: t('home.helpModal.cancellationStep3Desc'),
      refund: t('cancellation.strictRefund'),
      popular: false
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
          <h2 className="text-base sm:text-xl md:text-2xl font-bold text-gray-900">{t('cancellation.title')}</h2>
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
              {t('cancellation.intro')}
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
              <div className="flex items-start">
                <div className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center mr-2 sm:mr-3 mt-0.5 flex-shrink-0">
                  <i className="ri-information-line text-blue-500 text-sm sm:text-base"></i>
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900 text-xs sm:text-sm mb-1">{t('cancellation.importantTitle')}</h3>
                  <ul className="text-blue-800 text-xs space-y-1">
                    <li>• {t('cancellation.important1')}</li>
                    <li>• {t('cancellation.important2')}</li>
                    <li>• {t('cancellation.important3')}</li>
                    <li>• {t('cancellation.important4')}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Policy Information */}
          <div className="space-y-3 sm:space-y-4 mb-5 sm:mb-8">
            <h3 className="text-sm sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">{t('cancellation.policiesTitle')}</h3>
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
                          {t('cancellation.mostPopular')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3">{policy.description}</p>
                    <div className="bg-gray-50 rounded-lg p-2 sm:p-3">
                      <h4 className="font-medium text-gray-900 text-xs sm:text-sm mb-1">{t('cancellation.refundPolicyLabel')}</h4>
                      <p className="text-xs text-gray-600">{policy.refund}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Additional Information */}
          <div className="bg-gray-50 rounded-lg p-3 sm:p-6 mb-4 sm:mb-6">
            <h3 className="text-xs sm:text-base font-semibold text-gray-900 mb-3 sm:mb-4">{t('cancellation.additionalTitle')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
              <div>
                <h4 className="font-medium text-gray-900 text-xs sm:text-sm mb-1.5 sm:mb-2">{t('cancellation.hostCancellationsTitle')}</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• {t('cancellation.hostCancel1')}</li>
                  <li>• {t('cancellation.hostCancel2')}</li>
                  <li>• {t('cancellation.hostCancel3')}</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 text-xs sm:text-sm mb-1.5 sm:mb-2">{t('cancellation.forceMajeureTitle')}</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• {t('cancellation.forceMajeure1')}</li>
                  <li>• {t('cancellation.forceMajeure2')}</li>
                  <li>• {t('cancellation.forceMajeure3')}</li>
                </ul>
              </div>
            </div>
          </div>

          {/* How to Cancel */}
          <div className="bg-red-50 rounded-lg p-3 sm:p-6 mb-4 sm:mb-6">
            <h3 className="text-xs sm:text-base font-semibold text-gray-900 mb-3 sm:mb-4">{t('cancellation.howToTitle')}</h3>
            <div className="space-y-2 sm:space-y-3">
              {[
                { step: '1', title: t('cancellation.step1Title'), desc: t('cancellation.step1Desc') },
                { step: '2', title: t('cancellation.step2Title'), desc: t('cancellation.step2Desc') },
                { step: '3', title: t('cancellation.step3Title'), desc: t('cancellation.step3Desc') },
                { step: '4', title: t('cancellation.step4Title'), desc: t('cancellation.step4Desc') },
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
            <h3 className="text-xs sm:text-base font-semibold text-gray-900 mb-3 sm:mb-4">{t('common.faq')}</h3>
            <div className="space-y-2 sm:space-y-4">
              {[
                {
                  q: t('cancellation.faqRefundQ'),
                  a: t('cancellation.faqRefundA')
                },
                {
                  q: t('cancellation.faqModifyQ'),
                  a: t('cancellation.faqModifyA')
                },
                {
                  q: t('cancellation.faqEmergencyQ'),
                  a: t('cancellation.faqEmergencyA')
                },
                {
                  q: t('cancellation.faqHostCancelQ'),
                  a: t('cancellation.faqHostCancelA')
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
              {t('common.gotIt')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
