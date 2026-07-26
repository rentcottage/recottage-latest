import { useState } from 'react';
import { useT } from '../../i18n';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ContactModal({ isOpen, onClose }: ContactModalProps) {
  const { t } = useT();
  const [activeTab, setActiveTab] = useState('form');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return;

    // Validate required fields
    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      setSubmitStatus('error');
      return;
    }

    if (formData.message.length > 500) {
      setSubmitStatus('error');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const submitData = new URLSearchParams();
      submitData.append('name', formData.name);
      submitData.append('email', formData.email);
      submitData.append('subject', formData.subject);
      submitData.append('message', formData.message);

      const response = await fetch('https://readdy.ai/api/form/d3cmqknjefcg4ojr3adg', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: submitData.toString()
      });

      if (response.ok) {
        setSubmitStatus('success');
        setFormData({ name: '', email: '', subject: '', message: '' });
      } else {
        setSubmitStatus('error');
      }
    } catch (error) {
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[92vh] overflow-y-auto">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2 className="text-base sm:text-xl md:text-2xl font-bold text-gray-900">{t('account.contactModal.title')}</h2>
            <button
              onClick={onClose}
              className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <i className="ri-close-line text-lg sm:text-xl"></i>
            </button>
          </div>

          {/* Contact Tabs */}
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-4 sm:mb-6">
            <button
              onClick={() => setActiveTab('form')}
              className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-4 rounded-md text-xs sm:text-sm font-medium cursor-pointer whitespace-nowrap ${
                activeTab === 'form'
                  ? 'bg-white text-red-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('account.contactModal.tabForm')}
            </button>
            <button
              onClick={() => setActiveTab('info')}
              className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-4 rounded-md text-xs sm:text-sm font-medium cursor-pointer whitespace-nowrap ${
                activeTab === 'info'
                  ? 'bg-white text-red-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('account.contactModal.tabInfo')}
            </button>
            <button
              onClick={() => setActiveTab('faq')}
              className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-4 rounded-md text-xs sm:text-sm font-medium cursor-pointer whitespace-nowrap ${
                activeTab === 'faq'
                  ? 'bg-white text-red-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('account.contactModal.tabFaq')}
            </button>
          </div>

          {/* Contact Form Tab */}
          {activeTab === 'form' && (
            <div>
              {/* Success Message */}
              {submitStatus === 'success' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
                  <div className="flex items-center">
                    <div className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center mr-2 sm:mr-3">
                      <i className="ri-check-circle-line text-green-500 text-sm sm:text-base"></i>
                    </div>
                    <div>
                      <h3 className="font-semibold text-green-800 text-sm sm:text-base">{t('account.contactModal.successTitle')}</h3>
                      <p className="text-green-700 text-xs sm:text-sm">{t('account.contactModal.successBody')}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {submitStatus === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
                  <div className="flex items-center">
                    <div className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center mr-2 sm:mr-3">
                      <i className="ri-error-warning-line text-red-500 text-sm sm:text-base"></i>
                    </div>
                    <div>
                      <h3 className="font-semibold text-red-800 text-sm sm:text-base">{t('account.contactModal.errorTitle')}</h3>
                      <p className="text-red-700 text-xs sm:text-sm">{t('account.contactModal.errorBody')}</p>
                    </div>
                  </div>
                </div>
              )}

              <form id="contact-form" data-readdy-form onSubmit={handleSubmit} className="space-y-3 sm:space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                      {t('account.contactModal.fullName')}
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="w-full p-2 sm:p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      placeholder={t('account.contactModal.fullNamePlaceholder')}
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                      {t('account.contactModal.emailAddress')}
                    </label>
                    <input
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="w-full p-2 sm:p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      placeholder={t('account.contactModal.emailPlaceholder')}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    {t('account.contactModal.subject')}
                  </label>
                  <input
                    type="text"
                    name="subject"
                    required
                    value={formData.subject}
                    onChange={(e) => handleInputChange('subject', e.target.value)}
                    className="w-full p-2 sm:p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder={t('account.contactModal.subjectPlaceholder')}
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    {t('account.contactModal.message')}
                  </label>
                  <textarea
                    name="message"
                    required
                    rows={4}
                    value={formData.message}
                    onChange={(e) => handleInputChange('message', e.target.value)}
                    className="w-full p-2 sm:p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                    placeholder={t('account.contactModal.messagePlaceholder')}
                    maxLength={500}
                  ></textarea>
                  <div className="text-xs text-gray-500 mt-1">
                    {t('account.contactModal.charactersCount', { count: formData.message.length })}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap ${
                    isSubmitting
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-red-500 text-white hover:bg-red-600'
                  }`}
                >
                  {isSubmitting ? t('account.contactModal.sendingEllipsis') : t('account.contactModal.sendMessage')}
                </button>
              </form>
            </div>
          )}

          {/* Contact Info Tab */}
          {activeTab === 'info' && (
            <div className="space-y-5 sm:space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8">
                <div className="space-y-4 sm:space-y-6">
                  <div>
                    <h3 className="text-sm sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">{t('account.contactModal.getInTouch')}</h3>
                    <div className="space-y-3 sm:space-y-4">
                      <div className="flex items-start">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-100 rounded-lg flex items-center justify-center mr-3 sm:mr-4 flex-shrink-0">
                          <div className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center">
                            <i className="ri-mail-line text-red-500 text-sm sm:text-base"></i>
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 text-sm sm:text-base">{t('account.contactModal.emailSupport')}</h4>
                          <p className="text-gray-600 text-xs sm:text-sm">info.rentcottage@gmail.com</p>
                          <p className="text-xs text-gray-500">{t('account.contactModal.emailResponseTime')}</p>
                        </div>
                      </div>

                      <div className="flex items-start">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-100 rounded-lg flex items-center justify-center mr-3 sm:mr-4 flex-shrink-0">
                          <div className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center">
                            <i className="ri-message-3-line text-red-500 text-sm sm:text-base"></i>
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 text-sm sm:text-base">{t('account.contactModal.liveChat')}</h4>
                          <p className="text-gray-600 text-xs sm:text-sm">{t('account.contactModal.liveChatDesc')}</p>
                          <div className="flex space-x-2 mt-2">
                            <a href="https://www.instagram.com/rentcottage.ge/" target="_blank" rel="noopener noreferrer" className="flex items-center px-2.5 py-1.5 bg-pink-600 text-white rounded-lg hover:bg-pink-700 cursor-pointer whitespace-nowrap text-xs sm:text-sm">
                              <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center mr-1 sm:mr-1.5">
                                <i className="ri-instagram-fill"></i>
                              </div>
                              {t('account.contactModal.instagram')}
                            </a>
                            <a href="https://www.facebook.com/profile.php?id=61583084123461" target="_blank" rel="noopener noreferrer" className="flex items-center px-2.5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer whitespace-nowrap text-xs sm:text-sm">
                              <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center mr-1 sm:mr-1.5">
                                <i className="ri-facebook-fill"></i>
                              </div>
                              {t('account.contactModal.facebook')}
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">{t('account.contactModal.officeHours')}</h3>
                    <div className="space-y-1.5 sm:space-y-2 text-gray-600 text-xs sm:text-sm">
                      <div className="flex justify-between">
                        <span>{t('account.contactModal.mondayFriday')}</span>
                        <span>{t('account.contactModal.mondayFridayHours')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t('account.contactModal.saturday')}</span>
                        <span>{t('account.contactModal.saturdayHours')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t('account.contactModal.sunday')}</span>
                        <span>{t('account.contactModal.sundayHours')}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-2 sm:mt-3">
                        {t('account.contactModal.emergencyNote')}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">{t('account.contactModal.followUs')}</h3>
                  <div className="bg-gray-50 rounded-lg p-3 sm:p-6 space-y-3 sm:space-y-4">
                    <p className="text-gray-600 text-xs sm:text-sm">{t('account.contactModal.followUsDesc')}</p>
                    <div className="flex flex-col space-y-2 sm:space-y-3">
                      <a href="https://www.facebook.com/profile.php?id=61583084123461" target="_blank" rel="noopener noreferrer" className="flex items-center px-3 sm:px-4 py-2 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer whitespace-nowrap">
                        <div className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center mr-2 sm:mr-3">
                          <i className="ri-facebook-fill text-sm sm:text-base"></i>
                        </div>
                        <div>
                          <p className="font-medium text-xs sm:text-sm">{t('account.contactModal.facebook')}</p>
                          <p className="text-xs text-blue-200">{t('account.contactModal.facebookCta')}</p>
                        </div>
                      </a>
                      <a href="https://www.instagram.com/rentcottage.ge/" target="_blank" rel="noopener noreferrer" className="flex items-center px-3 sm:px-4 py-2 sm:py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 cursor-pointer whitespace-nowrap">
                        <div className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center mr-2 sm:mr-3">
                          <i className="ri-instagram-fill text-sm sm:text-base"></i>
                        </div>
                        <div>
                          <p className="font-medium text-xs sm:text-sm">{t('account.contactModal.instagram')}</p>
                          <p className="text-xs text-pink-200">{t('account.contactModal.instagramCta')}</p>
                        </div>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Help Tab */}
          {activeTab === 'faq' && (
            <div className="space-y-4 sm:space-y-6">
              <div>
                <h3 className="text-sm sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">{t('account.contactModal.faqTitle')}</h3>
                <div className="space-y-2 sm:space-y-4">
                  {[
                    { question: t('account.contactModal.faqQ1'), answer: t('account.contactModal.faqA1') },
                    { question: t('account.contactModal.faqQ2'), answer: t('account.contactModal.faqA2') },
                    { question: t('account.contactModal.faqQ3'), answer: t('account.contactModal.faqA3') },
                    { question: t('account.contactModal.faqQ4'), answer: t('account.contactModal.faqA4') },
                    { question: t('account.contactModal.faqQ5'), answer: t('account.contactModal.faqA5') },
                    { question: t('account.contactModal.faqQ6'), answer: t('account.contactModal.faqA6') },
                  ].map((faq, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-3 sm:p-4">
                      <h4 className="font-medium text-gray-900 text-xs sm:text-sm mb-1 sm:mb-2">{faq.question}</h4>
                      <p className="text-gray-600 text-xs leading-relaxed">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-3 sm:p-4">
                <div className="flex items-center">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center mr-2 sm:mr-3">
                    <i className="ri-information-line text-blue-500 text-sm sm:text-base"></i>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-blue-800">
                      <strong>{t('account.contactModal.responseTimeLabel')}</strong> {t('account.contactModal.responseTimeBody')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-center mt-4 sm:mt-6">
                <p className="text-xs text-gray-500">
                  {t('account.contactModal.footerNote')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
